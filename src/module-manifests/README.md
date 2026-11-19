# Automatic User Permissions for new TS Hub modules

Add a new `*.module.json` file when implementing a module. Example:

```json
{
  "id": "example_module",
  "name": "Example Module",
  "category": "OPERATIONS",
  "permissions": ["Example Module"]
}
```

Run `npm run permissions:sync`, then commit the new manifest and generated catalog. The UI will show the new permission in User Management and the managed-user API will accept it using the same catalog. New permissions default to **deny** for all existing users, including administrators, until explicitly assigned.

This registers permissions only; it does NOT activate a route, backend API, phone view or branch data access automatically. Every new module must explicitly check user permissions and device/branch access before showing or changing sensitive data.
