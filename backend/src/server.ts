import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, env.host, () => {
  console.log(`Backend RH Sanchez rodando em http://${env.host}:${env.port}`);
});
