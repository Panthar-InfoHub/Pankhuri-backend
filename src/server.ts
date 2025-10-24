import dotenv from "dotenv";
import express from "express";

//Configurations
const app = express();
dotenv.config();

//Middlewares


app.use(express.json());

//Health check
app.get("/ping", (_, res) => {
  res.status(200).send({ message: "server is running....." });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
