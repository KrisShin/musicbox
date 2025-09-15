use crate::{
    model::{PlaylistInfo, PlaylistMusic},
    my_util::DbPool,
};

pub async fn create_playlist(pool: &DbPool, name: String) -> Result<i64, sqlx::Error> {
    let result = sqlx::query("INSERT INTO playlist (name) VALUES (?)")
        .bind(name)
        .execute(pool)
        .await?;

    Ok(result.last_insert_rowid())
}

pub async fn delete_playlist(pool: &DbPool, playlist_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM playlist WHERE id = ?")
        .bind(playlist_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn rename_playlist(
    pool: &DbPool,
    playlist_id: i64,
    new_name: String,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE playlist SET name = ? WHERE id = ?")
        .bind(new_name)
        .bind(playlist_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn get_all_playlists(
    pool: &DbPool,
    song_id: Option<String>,
) -> Result<Vec<PlaylistInfo>, sqlx::Error> {
    let sql = r#"
        SELECT
            p.id,
            p.name,
            p.cover_path,
            p.created_at,
            p.updated_at,
            COUNT(ps.song_id) as song_count,
            EXISTS(SELECT 1 FROM playlist_music WHERE playlist_id = p.id AND song_id = ?) as is_in
        FROM
            playlist p
        LEFT JOIN
            playlist_music ps ON p.id = ps.playlist_id
        GROUP BY
            p.id
        ORDER BY
            p.created_at ASC
    "#;

    let playlists = sqlx::query_as::<_, PlaylistInfo>(sql)
        .bind(song_id) // 3. 绑定可选参数。如果 song_id 是 None，sqlx 会将其作为 NULL 绑定
        .fetch_all(pool)
        .await?;

    Ok(playlists)
}

pub async fn get_music_by_playlist_id(
    pool: &DbPool,
    playlist_id: i64,
) -> Result<Vec<PlaylistMusic>, sqlx::Error> {
    let music_list = sqlx::query_as::<_, PlaylistMusic>(
        r#"
            SELECT
                s.*, -- s.* 会被 sqlx::FromRow 自动映射到拥有 #[sqlx(flatten)] 的字段
                ps.position,
                ps.added_to_list_at
            FROM
                playlist_music ps
            INNER JOIN
                music s ON ps.song_id = s.song_id
            WHERE
                ps.playlist_id = ?
            ORDER BY
                ps.position DESC
        "#,
    )
    .bind(playlist_id)
    .fetch_all(pool)
    .await?;

    Ok(music_list)
}

/// [新增] 更新一个歌单的封面图片路径
pub async fn update_playlist_cover(
    pool: &DbPool,
    playlist_id: i64,
    cover_path: String,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE playlist SET cover_path = ? WHERE id = ?")
        .bind(cover_path)
        .bind(playlist_id)
        .execute(pool)
        .await?;

    Ok(())
}
