import { raw } from "hono/html";

export function Icon(props: { svg: string }) {
  return <span class="ico">{raw(props.svg)}</span>;
}
