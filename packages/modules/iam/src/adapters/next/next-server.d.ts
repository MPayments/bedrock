declare module "next/server" {
  export interface NextRequest extends Request {
    nextUrl: URL;
  }

  export class NextResponse extends Response {
    static next(init?: {
      request?: {
        headers?: Headers;
      };
    }): NextResponse;

    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
  }
}
