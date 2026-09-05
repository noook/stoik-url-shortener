ALTER TABLE "links" DROP CONSTRAINT "links_api_token_id_api_tokens_id_fk";
--> statement-breakpoint
ALTER TABLE "links" DROP COLUMN "custom";--> statement-breakpoint
ALTER TABLE "links" DROP COLUMN "api_token_id";