"use strict";

let crypto = require("crypto");


/**
 * ユーザー情報が格納されるオブジェクト
 * サーバー(app.js)からは直接アクセスしない(exportsしない)
 *
 * name: ユーザーが設定した名前。トリップがある場合は末尾に付加される。
 * id: IPアドレスから作成されたID
 * power: ユーザーの勢い
 * ip: ユーザーのIPアドレス
 * last_input: 最後にメッセージ等を入力した時刻(ミリ秒)
 */
let users = {};


/**
 * 接続が確立した時のユーザー情報初期化用
 * ユーザー名とIDを設定してクライアントに送信する
 * 設定したユーザー情報はmap{}に保存される
 */
let init_user_info = (socket) => {
  let name = "名無しさん";

  // 取得したipアドレスが "Pv4射影IPv6アドレス" 形式の場合はIPv6部分を取り除く
  let ip = socket.handshake.address;
  let idx = ip.lastIndexOf(":");
  if (idx != -1) {
    ip = ip.slice(idx + 1);
  }

  let sha512 = crypto.createHash("sha512");
  sha512.update(ip);
  let id = sha512.digest("base64").slice(0, 10);

  let new_user = {
    name: name,
    ip: ip,
    id: id,
    last_input: 0,
    power: 0
  };

  users[socket.id] = new_user;
}
exports.init_user_info = init_user_info;


/**
 * ユーザー情報取得用
 */
let get = (socket_id) => {
  if (!users[socket_id]) {
    return;
  }

  return {
    name: users[socket_id].name,
    id: users[socket_id].id,
    power: users[socket_id].power
  };
}
exports.get = get;


/**
 * ユーザー情報削除用
 * users{}から指定されたsocket.idのユーザーを削除する
 */
let delete_user = (socket_id) => {
  if (!users[socket_id]) {
    return;
  }

  delete users[socket_id];
}
exports.delete_user = delete_user;


/**
 * ユーザー名変更用
 * トリップが入力されている場合は名前に付加する
 */
let change_name = (socket_id, new_name) => {
  if (is_blank(new_name.name)) {
    new_name.name = "名無しさん";
  }
  new_name.name = new_name.name.slice(0, 16).replace(/◆/g, "■");

  if (new_name.trip.length >= 3) {
    let salt = new_name.trip.slice(1, 3);
    let key = crypto.createCipher("des", salt);
    key.update(new_name.trip, "utf-8", "base64");

    new_name.trip = "◆" + key.final("base64").slice(0, 10);
    new_name.name += new_name.trip;
  }

  users[socket_id].name = new_name.name;
}
exports.change_name = change_name;


/**
 * ユーザーの送信間隔を検証する
 *
 * 連投等の防止用
 * とりあえず1.5秒としている
 *
 * @param {string} socket_id : ユーザーを識別するためのソケットオブジェクト
 * @return {boolean} : 間隔が短い場合はtrue、問題が無ければfalse。
 */
let is_interval_short = (socket_id) => {
  let diff = Date.now() - users[socket_id].last_input;
  if (diff < 1500) {
    return true;
  }

  users[socket_id].last_input = Date.now();
  return false;
}
exports.is_interval_short = is_interval_short;


/**
 * ユーザーの入力が空であるかを検証する
 *
 * ユーザーが入力した文字列が
 * ・空文字("")
 * ・null
 * ・undefined
 * ・空白のみ("  "等)
 * かを検証し、空文字列・空白の連続などであった場合はtrueを返す。
 * そうで無ければfalseを返す。
 *
 * @param {string} user_input: ユーザーが入力した文字列
 * @return {boolean} 問題があればtrue、無ければfalse
 */
let is_blank = (user_input) => {
  if (!user_input) {
    return true;
  }

  let regex = /^[\s\n\r\t]+$/;
  if (regex.test(user_input)) {
    return true;
  }

  return false;
}
exports.is_blank = is_blank;


/**
 * 現在接続しているユーザーの情報を出力する
 *
 * 主にテスト用
 * 接続者数が増えるほど重くなる機能（のはず）
 * name, id, ip等全て表示される
 */
let put_all = () => {
  console.log("users:");
  console.log(users);
  console.log("-------------------------------------------------------------------------------");
}
exports.put_all = put_all;


/**
 * 同一IPからの接続を切断する
 * 接続者数が増えるほど重くなる機能（のはず）
 * 有効、無効を切り替える場合はheader.jsの"ip_alert"イベントも切り替えること
 * ※現在使用していない
 */
let is_duplicate_ip = (ip) => {
  for (let socket_id in users) {
    if (users[socket_id].ip == ip) {
      return true;
    }
  }

  return false;
}
exports.is_duplicate_ip = is_duplicate_ip;