package com.tiprelaycompanion.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class EventQueue(context: Context) : SQLiteOpenHelper(context, "tiprelay-events.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) { db.execSQL("CREATE TABLE events (event_id TEXT PRIMARY KEY, payload TEXT NOT NULL, created INTEGER NOT NULL, uploaded INTEGER NOT NULL DEFAULT 0)") }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    fun add(id: String, payload: String) {
        cleanup()
        writableDatabase.insertWithOnConflict("events", null, ContentValues().apply { put("event_id", id); put("payload", payload); put("created", System.currentTimeMillis()) }, SQLiteDatabase.CONFLICT_IGNORE)
    }
    fun pending(): List<Pair<String, String>> = readableDatabase.rawQuery("SELECT event_id,payload FROM events WHERE uploaded=0 ORDER BY created LIMIT 50", null).use { cursor -> buildList { while (cursor.moveToNext()) add(cursor.getString(0) to cursor.getString(1)) } }
    fun count(): Int = readableDatabase.rawQuery("SELECT count(*) FROM events WHERE uploaded=0", null).use { it.moveToFirst();it.getInt(0) }
    fun complete(id: String) { writableDatabase.update("events", ContentValues().apply { put("uploaded", 1); put("payload", "{}") }, "event_id=?", arrayOf(id)) }
    fun clear() { writableDatabase.delete("events", null, null) }
    fun cleanup() { writableDatabase.delete("events", "created<?", arrayOf((System.currentTimeMillis() - 86400000L).toString())) }
}
