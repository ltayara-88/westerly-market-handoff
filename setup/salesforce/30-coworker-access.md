# Agentforce Coworker access for the admin user

Coworker powers the Agentforce profile summary and "Ask Coworker" on unified profile cards. The org ships the
permission sets and licenses; they just need assigning. IDs differ per org, so look them up first.

```bash
sf data query -o <alias> -q "SELECT Id, DeveloperName FROM PermissionSetLicense WHERE DeveloperName IN ('AISearchAdminPsl','AISearchUserPsl')"
sf data query -o <alias> -q "SELECT Id, Name FROM PermissionSet WHERE Name IN ('AISearchAdmin','AISearchUser')"
```

| Order | Object | What |
|---|---|---|
| 1 | PermissionSetLicenseAssign | `AISearchAdminPsl` (Agentforce Coworker Setup) |
| 2 | PermissionSetLicenseAssign | `AISearchUserPsl` (Agentforce Coworker) |
| 3 | PermissionSetAssignment | `AISearchAdmin` (Agentforce Coworker Admin) |
| 4 | PermissionSetAssignment | `AISearchUser` (Agentforce Coworker User) |

```bash
sf data create record -o <alias> -s PermissionSetLicenseAssign -v "AssigneeId=<USER_ID> PermissionSetLicenseId=<PSL_ID>"
sf data create record -o <alias> -s PermissionSetAssignment -v "AssigneeId=<USER_ID> PermissionSetId=<PERMSET_ID>"
```

Check: `SELECT PermissionsAISearchUser, PermissionsAISearchAdmin FROM UserPermissionAccess` returns both true.
