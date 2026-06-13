// Twilio WhatsApp Sandbox connection details, surfaced in-app so staff can
// self-onboard. When the account moves to a production WhatsApp sender, the
// join step goes away — flip SANDBOX_ACTIVE to false to hide the instructions.
export const SANDBOX_ACTIVE = true
export const SANDBOX_NUMBER = '+1 415 523 8886'
export const SANDBOX_JOIN_CODE = 'join stood-believed'
// Pre-filled WhatsApp deep link: opens a chat to the sandbox with the join code ready to send.
export const SANDBOX_WA_LINK = 'https://wa.me/14155238886?text=join%20stood-believed'
