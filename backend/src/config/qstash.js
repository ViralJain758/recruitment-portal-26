import { Client, Receiver } from "@upstash/qstash";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.QSTASH_TOKEN?.trim();

export const qstashClient = token ? new Client({ token }) : null;

export const qstashReceiver =
  process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
    ? new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      })
    : null;
