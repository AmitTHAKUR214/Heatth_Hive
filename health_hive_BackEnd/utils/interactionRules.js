export const INTERACTION_RULES = {
  guest: {
    like: false,
    dislike: false,
    comment: false,
    share: true,
    flag: false
  },
  registeredGuest: {
    like: false,
    dislike: false,
    comment: false,
    share: true,
    flag: false
  },
  student: {
    like: true,
    dislike: true,
    comment: true,
    share: true,
    flag: true
  },
  user: {
    like: true,
    dislike: true,
    comment: true,
    share: true,
    flag: true
  },
  doctor: {
    like: true,
    dislike: false,
    comment: true,
    share: true,
    flag: true
  },
  pharmacist: {
    like: true,
    dislike: false,
    comment: true,
    share: true,
    flag: true
  },
  admin: {
    like: true,
    dislike: true,
    comment: true,
    share: true,
    flag: true
  }
};


// ✅ Why this is critical
// No hard-coded role logic in routes
// One file controls the whole platform
// Change behavior later without refactor