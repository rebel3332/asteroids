# Защити город — простой веб-игра на Flask

Коротко: сервер на `Flask` отдаёт статические файлы и API для таблицы лидеров.

Запуск локально (Windows PowerShell):

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Откройте в телефоне: `http://<IP_компьютера>:5000`

Файлы:
- `app.py` — основной сервер
- `templates/index.html` — игра
- `static/js/game.js` — логика игры
- `static/css/style.css` — стили

Дальше можно: добавить анимации, эффекты, бэкэнд-валидацию, защиту от фраудов и авторизацию.
