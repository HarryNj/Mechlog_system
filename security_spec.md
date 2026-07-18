# Firestore Security Specification

This security specification outlines the data invariants, threat model, and test scenarios designed to validate that the rules in `DRAFT_firestore.rules` are airtight and robust against tampering.

## Data Invariants

1. **Identity Isolation**: A user can only read and modify their own `/users/{userId}` profile document. Only verified administrators can change roles or access other user profiles.
2. **Access-to-Resource Verification**: Anyone can read registered motorcycles, but writing and updating is restricted to authenticated users or administrators.
3. **No Terminal State Shortcuts**: Service requests cannot bypass the logical states (e.g., from `pending` straight to another custom invalid status).
4. **Id Safety**: All custom IDs must pass valid character regex validations to prevent injection attacks or denial-of-service volumetric data payloads.

## The "Dirty Dozen" Malicious Payloads

The following 12 payloads attempt to compromise our systems and should be rejected with `PERMISSION_DENIED`.

1. **Privilege Escalation**: Modifying role to `admin` in `/users/{userId}` as a standard user.
2. **ID Poisoning (Bikes)**: Injecting a 2MB binary string as a Bike ID.
3. **Identity Spoofing**: Attempting to write a user profile with `uid` representing another user.
4. **Invalid State Transition**: Updating a service request with status `invalid_random_state`.
5. **No Auth Access**: Attempting to list bikes without an authentication header.
6. **Spoofing Email Verification**: Attempting to perform write operations with `email_verified` spoofed on a guest email.
7. **Volumetric Overflow (Bikes)**: Injecting a `regNo` string with 1,000 characters.
8. **Unowned Document Deletion**: A standard user attempting to delete another user's service request.
9. **Spares Manipulation**: A non-admin user attempting to create or update spares inventory.
10. **Service Log Hijacking**: Standard user attempting to modify work logs filled by another officer.
11. **Negative Inventory Inject**: Attempting to set spare quantity to a negative number like `-50`.
12. **Blanket Query Scraping**: Attempting to list all users' private files without an owner filter.

---
The rules have been designed and written to `DRAFT_firestore.rules` to handle all cases safely.
