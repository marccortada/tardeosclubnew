import { redirect } from "next/navigation";

/** El directorio de colaboradores es ahora /directorio (v2). */
export default function Colaboradores() {
  redirect("/directorio");
}
