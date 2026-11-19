-- Only the three provisioned demonstration identities have an approved mapping.
-- Stop before changing data if another account requires an explicit CPF mapping.
BEGIN;
LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "User"
        WHERE "email" NOT IN (
            'cidadao.a@mycity.example',
            'cidadao.b@mycity.example',
            'gestor@mycity.example'
        )
    ) THEN
        RAISE EXCEPTION 'Unmapped users: provide an explicit CPF mapping before migration';
    END IF;
END $$;

ALTER TYPE "Role" RENAME VALUE 'CITIZEN' TO 'citizen';
ALTER TYPE "Role" RENAME VALUE 'MANAGER' TO 'manager';
ALTER TYPE "Role" RENAME TO "user_role";

UPDATE "User" SET "email" = CASE "email"
    WHEN 'cidadao.a@mycity.example' THEN '00000000001'
    WHEN 'cidadao.b@mycity.example' THEN '00000000002'
    WHEN 'gestor@mycity.example' THEN '00000000003'
END;

ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "users" RENAME COLUMN "email" TO "cpf";
ALTER TABLE "users" ALTER COLUMN "cpf" TYPE VARCHAR(11);
ALTER TABLE "users" ADD CONSTRAINT "users_cpf_format_check" CHECK ("cpf" ~ '^[0-9]{11}$');
ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "users" ADD COLUMN "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";
ALTER INDEX "User_email_key" RENAME TO "users_cpf_key";
COMMIT;
