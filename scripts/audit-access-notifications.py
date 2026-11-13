#!/usr/bin/env python3
"""Read-only TS Hub access/policy audit. Run in authorized Google Cloud Shell.

Only GET requests are made. Field masks exclude PINs, passwords, employee
records, notification contents, tokens and biometric data. No Firebase
rules, permissions, users, policies or notification documents are modified.
"""
import collections
import json
import subprocess
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "timbersmithapp"
APP = "timbersmith-terminal-v1"
ROOT = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
RULES = "https://firebaserules.googleapis.com/v1"
TOKEN = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()

def get(url, params=()):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + TOKEN}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            return json.load(res)
    except urllib.error.HTTPError as exc:
        print("READ FAILED:", urllib.parse.urlsplit(url).path, "HTTP", exc.code)
        return None

def decode(value):
    if "mapValue" in value:
        return {k:decode(v) for k,v in value["mapValue"].get("fields",{}).items()}
    if "arrayValue" in value:
        return [decode(v) for v in value["arrayValue"].get("values",[])]
    for key in ("stringValue","booleanValue","timestampValue","integerValue","doubleValue","nullValue"):
        if key in value:
            return value[key]
    return None

def docs(path, fields):
    out = []
    params = [("pageSize","100")] + [("mask.fieldPaths",field) for field in fields]
    next_page = ""
    while True:
        query = params + ([("pageToken",next_page)] if next_page else [])
        result = get(ROOT + "/" + urllib.parse.quote(path,safe="/"),query)
        if result is None:
            return None
        for item in result.get("documents",[]):
            row = {key:decode(value) for key,value in item.get("fields",{}).items()}
            row["documentId"] = item["name"].rsplit("/",1)[-1]
            out.append(row)
        next_page = result.get("nextPageToken")
        if not next_page:
            return out

def report(label,data):
    print("\n=== " + label + " ===")
    print(json.dumps(data,indent=2,ensure_ascii=False))

def email(row):
    return str(row.get("email") or row.get("userEmail") or "").strip().lower()

focus = {"stock@tsjoinery.co.za","frans@tsjoinery.co.za","franz@tsjoinery.co.za","janah@tsjoinery.co.za"}
print("READ-ONLY AUDIT", PROJECT)
users = docs(f"artifacts/{APP}/private/users/active",["id","email","role","roleId","active","isApproved","deviceAccess","deviceViewAccess","userPermissions","permissions"])
overrides = docs("userPermissionOverrides",["userId","userEmail","deviceAccess","deviceViewAccess","permissions","deviceOverrides","updatedAt"])
roles = docs(f"artifacts/{APP}/public/roles/items",["id","roleName","status"])
matrices = docs("rolePermissions",["roleId","roleName","permissions","updatedAt"])
assignments = docs("userRoles",["userId","userEmail","roleId","roleName","updatedAt"])
policies = docs(f"artifacts/{APP}/private/config/notifications_policies",["eventId","enabled","priority","recipientUserIds","coalesceEnabled","coalesceWindowMinutes","updatedAt"])

if users is not None:
    emails = collections.Counter(email(row) for row in users if email(row))
    report("ALL ACTIVE ACCOUNT SUMMARY",{
        "documentCount":len(users),
        "countsByRole":dict(collections.Counter(str(row.get("role","UNASSIGNED")) for row in users)),
        "duplicateEmailGroups":sum(count>1 for count in emails.values()),
        "accountsWithDeviceAccess":sum("deviceAccess" in row for row in users),
        "accountsWithDeviceViewAccess":sum("deviceViewAccess" in row for row in users),
    })
    report("STOCK / FRANS / JANAH ACCOUNT CONFIGURATION",[row for row in users if email(row) in focus])
else:
    report("ALL ACTIVE ACCOUNT SUMMARY","Unavailable")

target_ids = {str(row.get("id") or row["documentId"]) for row in (users or []) if email(row) in focus}
target_ids.update(row["documentId"] for row in (users or []) if email(row) in focus)
if overrides is not None:
    report("PERMISSION OVERRIDE SUMMARY",{
        "documentCount":len(overrides),
        "duplicateUserIdGroups":sum(c>1 for c in collections.Counter(row.get("userId") for row in overrides if row.get("userId")).values()),
        "duplicateEmailGroups":sum(c>1 for c in collections.Counter(email(row) for row in overrides if email(row)).values()),
        "focusRecords":[row for row in overrides if email(row) in focus or row.get("userId") in target_ids or row["documentId"] in target_ids]
    })
report("ROLE DEFINITIONS",roles)
if matrices is not None:
    report("ROLE MATRIX SUMMARY",[
        {"documentId":row["documentId"],"roleId":row.get("roleId"),"roleName":row.get("roleName"),
         "moduleCount":len(row.get("permissions") or {}),
         **({"permissions":row.get("permissions")} if "kanban" in str(row.get("roleName","")).lower() else {})}
        for row in matrices
    ])
if assignments is not None:
    report("FOCUS ROLE ASSIGNMENTS",[row for row in assignments if email(row) in focus or row.get("userId") in target_ids])
if policies is not None:
    active_ids = {str(row.get("id") or row["documentId"]) for row in (users or [])}
    active_ids.update(row["documentId"] for row in (users or []))
    report("NOTIFICATION POLICIES",[
        {**row,"unresolvedRecipientIds":[uid for uid in row.get("recipientUserIds",[]) if uid not in active_ids] if users is not None else None}
        for row in policies
    ])

for row in users or []:
    if email(row) not in focus:
        continue
    for uid in sorted({str(row.get("id") or row["documentId"]),row["documentId"]}):
        items=docs(f"artifacts/{APP}/users/{uid}/notifications",["recipientUserId","eventId","isRead","priority"])
        if items is not None:
            report("NOTIFICATION COUNTS "+email(row)+" / "+uid,{
                "total":len(items),
                "unreadVisible":sum(not item.get("isRead",False) and item.get("priority")!="silent" for item in items),
                "wrongRecipientRecords":sum(item.get("recipientUserId")!=uid for item in items),
                "countsByEvent":dict(collections.Counter(str(item.get("eventId","unknown")) for item in items))
            })

release=get(f"{RULES}/projects/{PROJECT}/releases/cloud.firestore")
if release and release.get("rulesetName"):
    rules=get(RULES+"/"+release["rulesetName"])
    if rules:
        print("\n=== CURRENT FIRESTORE SECURITY RULES ===")
        for file in rules.get("source",{}).get("files",[]):
            print(file.get("name","firestore.rules"))
            print(file.get("content",""))
print("\nAUDIT COMPLETE — no cloud data changed.")
