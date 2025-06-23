import { customAlphabet } from 'nanoid';

class NanoidGenerator {
  private static instance: NanoidGenerator;
  private readonly generator: (size?: number) => string;

  private constructor() {
    this.generator = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 16);
  }

  public static getInstance(): NanoidGenerator {
    if (!NanoidGenerator.instance) {
      NanoidGenerator.instance = new NanoidGenerator();
    }
    return NanoidGenerator.instance;
  }

  public generate(size?: number): string {
    return this.generator(size);
  }
}

// Export a singleton instance
export const nanoidGenerator = NanoidGenerator.getInstance(); 