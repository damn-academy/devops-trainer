/** Tracks active time across explicit pauses and saved attempts. */
export class ActiveTimer {
  private at: number;
  paused = false;
  constructor(private spent = 0, private now = () => Date.now()) { this.at = now(); }
  elapsed(): number { return this.spent + (this.paused ? 0 : Math.max(0, this.now() - this.at)); }
  toggle(): void {
    this.spent = this.elapsed();
    this.at = this.now();
    this.paused = !this.paused;
  }
}
