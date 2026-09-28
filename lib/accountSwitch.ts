// What the Settings account switch says, from whichever side it is read.
//
// Pure and import-free so both directions can be tested without a DOM. The
// component this feeds was lifted out of the builder sidebar, where "the other
// account" could only mean tester; it said "Switch to tester account" to
// testers for six weeks because nothing told it who was looking.

type Role = "builder" | "tester"

export function otherRole(active: Role): Role {
  return active === "builder" ? "tester" : "builder"
}

const ADD_BODY: Record<Role, string> = {
  // Adding a tester account, seen from the builder side.
  tester:
    "Testing someone else's product is how you earn reports on your own. You'll complete a short tester profile first — a few fields and your skills.",
  // Adding a builder account, seen from the tester side. Not the sentence
  // above with the nouns swapped: this person is putting their own product in
  // front of testers. Specifics from /guides/builder §1 and §3.
  builder:
    "Put something you've built in front of other testers. You add a project, write a short test case — one action and what should happen, per step — and get back a step-by-step report from each tester. You'll confirm your details first; it's one short step.",
}

// Role-neutral on purpose: `profiles` is shared, so "not what your profile
// says" is true from either side.
const BOTH_BODY =
  "You hold both. They are separate accounts with their own dashboards and their own history — switching changes which one you are using, not what your profile says."

export function accountSwitchCopy(active: Role, holdsOther: boolean) {
  const other = otherRole(active)
  const name = other === "tester" ? "Tester" : "Builder"
  return {
    other,
    heading: `${name} account`,
    body: holdsOther ? BOTH_BODY : ADD_BODY[other],
    label: holdsOther ? `Switch to ${other} account` : `Add ${other} account`,
  }
}
