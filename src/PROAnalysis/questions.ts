type QuestionType = {
  [key: string]: {
    [key: string]: number
  }
}
export const mpFeelingQuestions: QuestionType = {
  tenseLevel: {
    "Not at all": 0,
    "From time to time, occasionally": 1,
    "A lot of the time": 2,
    "Most of the time": 3,
  },
  frightenedLevel: {
    "Not at all": 0,
    "A little, but it doesn't worry me": 1,
    "Yes, but not too badly": 2,
    "Very definitely and quite badly": 3,
  },
  worryAmount: {
    "Only occasionally": 0,
    "From time to time, but not too often": 1,
    "A lot of the time": 2,
    "A great deal of the time": 3,
  },
  easeFrequency: {
    "Definitely": 0,
    "Usually": 1,
    "Not Often": 2,
    "Not at all": 3,
  },
  frightenedFrequency: {
    "Not at all": 0,
    "Occasionally": 1,
    "Quite Often": 2,
    "Very Often": 3,
  },
  restlessAmount: {
    "Not at all": 0,
    "Not very much": 1,
    "Quite a lot": 2,
    "Very much indeed": 3,
  },
  panicFrequency: {
    "Not at all": 0,
    "Not very often": 1,
    "Quite often": 2,
    "Very often indeed": 3,
  },
}
