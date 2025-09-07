import { randomInt } from "crypto";

export default function generateOTP(): string {
  const min = Math.pow(10, 6 - 1);
  const max = Math.pow(10, 6) - 1;
  
  return randomInt(min, max + 1).toString();
}
