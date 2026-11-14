import { cloudflareAccessIdentity } from "./admin/identity";
import { createApp } from "./app";

export default createApp({ identity: cloudflareAccessIdentity });
