from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS "tb_music" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "create_time" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(128) NOT NULL,
    "platform" VARCHAR(8) NOT NULL  DEFAULT 'QQ',
    "url" VARCHAR(512) NOT NULL UNIQUE,
    "is_valid" BOOL NOT NULL  DEFAULT True,
    "quality" SMALLINT NOT NULL  DEFAULT 128,
    "is_support_download" BOOL NOT NULL  DEFAULT False,
    "download_count" INT NOT NULL  DEFAULT 0,
    "play_count" INT NOT NULL  DEFAULT 0,
    "format" VARCHAR(4) NOT NULL  DEFAULT 'mp3',
    "publish_time" TIMESTAMPTZ,
    "singer" VARCHAR(128),
    "album_cover" VARCHAR(512),
    "album_name" VARCHAR(128),
    "duration" DOUBLE PRECISION NOT NULL  DEFAULT 0,
    "music_id" VARCHAR(128) NOT NULL,
    CONSTRAINT "uid_tb_music_platfor_4b957c" UNIQUE ("platform", "music_id")
);
COMMENT ON COLUMN "tb_music"."platform" IS 'music from witch platform';
COMMENT ON COLUMN "tb_music"."url" IS 'music url';
COMMENT ON COLUMN "tb_music"."is_valid" IS 'is valid';
COMMENT ON COLUMN "tb_music"."quality" IS 'music quality';
COMMENT ON COLUMN "tb_music"."is_support_download" IS 'is support download';
COMMENT ON COLUMN "tb_music"."download_count" IS 'download count';
COMMENT ON COLUMN "tb_music"."play_count" IS 'play count';
COMMENT ON COLUMN "tb_music"."format" IS 'music format';
COMMENT ON COLUMN "tb_music"."publish_time" IS 'publish time';
COMMENT ON COLUMN "tb_music"."singer" IS 'singer';
COMMENT ON COLUMN "tb_music"."album_cover" IS 'cover';
COMMENT ON COLUMN "tb_music"."album_name" IS 'album';
COMMENT ON COLUMN "tb_music"."duration" IS 'duration';
COMMENT ON COLUMN "tb_music"."music_id" IS 'music id';
CREATE TABLE IF NOT EXISTS "tb_lyric" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "create_time" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "lyric" TEXT NOT NULL,
    "music_id" INT NOT NULL UNIQUE REFERENCES "tb_music" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "tb_lyric"."lyric" IS 'lyric';
COMMENT ON COLUMN "tb_lyric"."music_id" IS 'music';
COMMENT ON TABLE "tb_lyric" IS 'lyric model';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """
