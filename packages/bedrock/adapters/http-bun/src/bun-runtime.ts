declare const Bun: {
  serve(options: {
    port?: number;
    hostname?: string;
    fetch(request: Request): Response | Promise<Response>;
  }): {
    stop(): void;
  };
};

export { Bun };
