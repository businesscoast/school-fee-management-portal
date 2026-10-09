export const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Karan', 'Dev', 'Kabir', 'Aryan',
  'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Myra', 'Ira', 'Anika', 'Navya', 'Kiara', 'Riya', 'Sneha', 'Pooja', 'Meera', 'Tanvi', 'Nisha',
  'Priya', 'Kavya', 'Shreya', 'Isha', 'Neha', 'Varun', 'Nikhil', 'Siddharth', 'Harsh', 'Manav', 'Yash', 'Pranav', 'Tanish', 'Ayaan',
  'Advait', 'Shaurya', 'Rudra', 'Atharv', 'Om', 'Parth', 'Lakshmi', 'Divya', 'Gauri', 'Bhavya', 'Charvi', 'Jiya', 'Mahi', 'Pari',
  'Sara', 'Zara', 'Aisha', 'Fatima', 'Ahmed', 'Imran', 'Farhan', 'Rehan', 'Joseph', 'Maria', 'John', 'Anjali', 'Deepika', 'Nandini',
  'Tejas', 'Vedant', 'Arnav', 'Dhruv', 'Samarth', 'Ritvik', 'Hrithik', 'Lavanya', 'Keerthi', 'Harini', 'Sanjana', 'Vaishnavi',
];

export const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Reddy', 'Rao', 'Nair', 'Menon', 'Iyer', 'Iyengar', 'Patel', 'Shah', 'Mehta', 'Joshi',
  'Desai', 'Pillai', 'Naidu', 'Chaudhary', 'Mishra', 'Pandey', 'Tiwari', 'Dubey', 'Yadav', 'Jain', 'Agarwal', 'Bose', 'Banerjee',
  'Mukherjee', 'Das', 'Sen', 'Ghosh', 'Khan', 'Ali', 'Sheikh', 'Fernandes', "D'Souza", 'Thomas', 'Mathew', 'Kulkarni', 'Deshpande',
  'Gowda', 'Hegde', 'Shetty', 'Bhat', 'Kamath', 'Prasad', 'Raj', 'Murthy', 'Krishnan',
];

export const PARENT_FIRST = [
  'Rajesh', 'Suresh', 'Ramesh', 'Mahesh', 'Anil', 'Sunil', 'Vikram', 'Prakash', 'Manoj', 'Sanjay', 'Ajay', 'Vijay', 'Sunita', 'Anita',
  'Kavita', 'Rekha', 'Sudha', 'Lata', 'Geeta', 'Seema', 'Meena', 'Usha', 'Harish', 'Girish', 'Naveen', 'Praveen', 'Santosh', 'Dinesh',
];

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

export function int(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

export function shuffle<T>(r: () => number, arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
