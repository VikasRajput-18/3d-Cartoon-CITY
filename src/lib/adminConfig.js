// Admin access control.
// Admins can be granted by Clerk user ID OR by email address.
// Emails are the easiest — just add the player's login email below.
export const ADMIN_IDS = [
  // 'user_2abc...'  // optional: Clerk user IDs
]

export const ADMIN_EMAILS = [
  'vikasvikas988099@gmail.com',
  'vikasvikas98809@gmail.com',
]

const _normEmails = ADMIN_EMAILS.map(e => e.trim().toLowerCase())

/** Check by Clerk user ID only (back-compat). */
export function isAdmin(uid) {
  return ADMIN_IDS.includes(uid)
}

/** Check the full Clerk user object — matches by ID or any verified email. */
export function isAdminUser(user) {
  if (!user) return false
  if (ADMIN_IDS.includes(user.id)) return true
  const emails = [
    user.primaryEmailAddress?.emailAddress,
    ...(user.emailAddresses?.map(e => e.emailAddress) ?? []),
  ].filter(Boolean).map(e => e.toLowerCase())
  return emails.some(e => _normEmails.includes(e))
}
