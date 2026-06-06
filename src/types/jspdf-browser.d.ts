// Import the browser build of jspdf to avoid fflate/node.cjs SSR issue with Turbopack
declare module "jspdf/dist/jspdf.es.min.js" {
  export { default } from "jspdf"
}
