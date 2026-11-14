import { redirect } from "next/navigation";

/** /tools is the friendly address for the tools page at /test. */
export default function ToolsAlias() {
  redirect("/test");
}
