declare module 'require' {
  const require: {
    (path: string): any;
    has: (path: string) => boolean;
  };

  export default require;
}
