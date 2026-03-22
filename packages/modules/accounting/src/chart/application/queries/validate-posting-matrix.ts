import type { ChartReads } from "../ports/chart.reads";
import { PostingMatrix } from "../../domain";

export class ValidatePostingMatrixQuery {
  constructor(private readonly reads: ChartReads) {}

  async execute() {
    const postingMatrix = await this.reads.readPostingMatrix();

    return new PostingMatrix(postingMatrix).validate();
  }
}
