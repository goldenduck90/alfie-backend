/** Calculates the body mass index (BMI)given a weight in pounds and height in inches. */
export function calculateBMI(weightLbs: number, heightInches: number): number {
  return (weightLbs / heightInches / heightInches) * 703.071720346
}
