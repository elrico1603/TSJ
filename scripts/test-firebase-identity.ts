import assert from 'node:assert/strict';

import {
  FirebaseIdentityService,
  type IdentityDependencies
} from '../server/firebaseIdentityService';

const uid = 'firebase-test-uid';
const email = 'test@tsjoinery.co.za';
const profileId = 'test-profile';

function fixture() {
  const identity = {
    uid,
    email,
    firebase: {
      sign_in_provider: 'password'
    }
  };

  const link = {
    uid,
    email,
    profileId,
    active: true
  };

  const profile = {
    firebaseUid: uid,
    email,
    name: 'Test User',
    role: 'Employee',
    active: true,
    isApproved: true,
    status: 'active',
    pin: 'test-secret',
    password: 'test-secret'
  };

  const dependencies: IdentityDependencies = {
    verifyToken: async () => identity,
    readLink: async () => link,
    readProfile: async () => profile
  };

  return {
    identity,
    link,
    profile,
    dependencies,
    service: new FirebaseIdentityService(dependencies)
  };
}

async function main() {
  let passed = 0;

  async function check(
    name: string,
    action: () => Promise<void>
  ) {
    await action();
    passed++;
    console.log('PASS | ' + name);
  }

  await check('Correct identity resolves', async () => {
    const f = fixture();
    const result = await f.service.resolveToken('token');

    assert.equal(result.uid, uid);
    assert.equal(result.profileId, profileId);
    assert.equal(result.email, email);
  });

  await check('No password or PIN returned', async () => {
    const f = fixture();
    const result = await f.service.resolveToken('token');

    assert.equal('pin' in result, false);
    assert.equal('password' in result, false);
  });

  await check('Missing token rejected', async () => {
    const f = fixture();
    await assert.rejects(
      f.service.resolveToken('')
    );
  });

  await check('Invalid token rejected', async () => {
    const f = fixture();

    f.dependencies.verifyToken = async () => {
      throw new Error('Invalid token');
    };

    await assert.rejects(
      f.service.resolveToken('invalid')
    );
  });

  await check('Anonymous account rejected', async () => {
    const f = fixture();

    f.identity.firebase.sign_in_provider =
      'anonymous';

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Missing identity link rejected', async () => {
    const f = fixture();
    f.dependencies.readLink = async () => null;

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Incorrect UID rejected', async () => {
    const f = fixture();
    f.link.uid = 'wrong-uid';

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Incorrect email rejected', async () => {
    const f = fixture();
    f.link.email = 'wrong@tsjoinery.co.za';

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Disabled identity rejected', async () => {
    const f = fixture();
    f.link.active = false;

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Missing profile rejected', async () => {
    const f = fixture();
    f.dependencies.readProfile = async () => null;

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Profile UID mismatch rejected', async () => {
    const f = fixture();
    f.profile.firebaseUid = 'wrong-profile-uid';

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Inactive profile rejected', async () => {
    const f = fixture();
    f.profile.active = false;

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Unapproved profile rejected', async () => {
    const f = fixture();
    f.profile.isApproved = false;

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  await check('Deleted profile rejected', async () => {
    const f = fixture();
    f.profile.status = 'deleted';

    await assert.rejects(
      f.service.resolveToken('token')
    );
  });

  console.log('\n=== IDENTITY TEST RESULT ===');
  console.log(`${passed}/14 tests passed`);
}

main().catch(error => {
  console.error('IDENTITY TEST FAILED:', error);
  process.exitCode = 1;
});
