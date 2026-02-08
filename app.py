from flask import Flask, render_template, request, jsonify, g
import sqlite3
import os
import time

DB = os.path.join(os.path.dirname(__file__), 'leaderboard.db')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB, check_same_thread=False)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.execute('''
    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        score INTEGER,
        ts INTEGER
    )''')
    db.commit()

app = Flask(__name__, static_folder='static', template_folder='templates')

# Initialize DB immediately inside an application context so it exists before serving
with app.app_context():
    init_db()

@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/leaderboard', methods=['GET'])
def leaderboard():
    db = get_db()
    cur = db.execute('SELECT name, score FROM scores ORDER BY score DESC, ts ASC LIMIT 5')
    rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/submit_score', methods=['POST'])
def submit_score():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()[:32]
    try:
        score = int(data.get('score', 0))
    except Exception:
        return jsonify({'ok': False, 'error': 'invalid score'}), 400
    db = get_db()
    cur = db.execute('SELECT score FROM scores ORDER BY score DESC, ts ASC LIMIT 5')
    rows = [r['score'] for r in cur.fetchall()]
    qualifies = len(rows) < 5 or (rows and score > rows[-1])
    if not qualifies:
        return jsonify({'ok': False, 'qualifies': False})
    db.execute('INSERT INTO scores (name, score, ts) VALUES (?,?,?)', (name or 'Anonymous', score, int(time.time())))
    db.commit()
    db.execute('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, ts ASC LIMIT 5)')
    db.commit()
    return jsonify({'ok': True, 'qualifies': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
