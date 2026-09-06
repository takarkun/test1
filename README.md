# 夫婦共有ToDoの設定

## 1. Supabaseプロジェクトを作る

Supabaseでプロジェクトを作成し、SQL Editorで `supabase-setup.sql` の内容を実行します。

## 2. Realtimeを有効にする

DatabaseのReplication設定で `todo_rooms` のRealtimeを有効にします。SQLの最後の行で追加される場合もあります。

## 3. 接続情報を入れる

SupabaseのProject Settings > APIから、次の値を確認します。

- Project URL
- anon public key

`script.js` の `SUPABASE_URL` と `SUPABASE_ANON_KEY` に設定してください。

## 4. 共有する

1. アプリを開き、共有部屋コードを入力して「共有する」を押す
2. 夫婦それぞれの端末で同じ部屋コードを入力する
3. 追加、完了、削除が自動で同期される

部屋コードを知っている人はその部屋を操作できるため、推測しにくいコードを使ってください。
