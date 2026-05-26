import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Backend RH Sanchez rodando em http://localhost:${env.port}`);
});
