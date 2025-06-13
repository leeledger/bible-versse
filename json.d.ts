// Tell TypeScript that we can import JSON files
declare module '*.json' {
  const value: any;
  export default value;
}
