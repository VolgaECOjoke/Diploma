from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import os
from datetime import datetime
from typing import Dict, Any

app = FastAPI(title="ARM Service Desk", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Конфигурация - правильные пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, '../frontend')
DATA_DIR = os.path.join(BASE_DIR, 'data')
ARMS_FILE = os.path.join(DATA_DIR, 'arms.json')
TICKETS_FILE = os.path.join(DATA_DIR, 'tickets.json')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')

# Создаем папки
os.makedirs(DATA_DIR, exist_ok=True)

# Модели данных
class UserLogin(BaseModel):
    username: str
    password: str

class ARMCreate(BaseModel):
    inventory_number: str
    name: str
    location: str
    user: str
    department: str
    characteristics: Dict[str, str]

class ARMUpdate(BaseModel):
    inventory_number: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = None
    user: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    characteristics: Optional[Dict[str, str]] = None

class TicketCreate(BaseModel):
    arm_id: str
    problem_type: str
    priority: str
    description: str

class TicketUpdate(BaseModel):
    status: str

# Утилиты
def save_data(data, filename):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Ошибка сохранения: {e}")
        return False

def load_data(filename):
    if os.path.exists(filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Ошибка загрузки: {e}")
    return []

# Инициализация данных
def init_data():
    # Пользователи
    if not os.path.exists(USERS_FILE):
        users = {
            "user": "user123",
            "admin": "admin123"
        }
        save_data(users, USERS_FILE)
        print("✅ Созданы пользователи: user/user123, admin/admin123")

    # АРМ - пустой список
    if not os.path.exists(ARMS_FILE):
        save_data([], ARMS_FILE)
        print("✅ Создан пустой файл АРМ")

    # Заявки - пустой список
    if not os.path.exists(TICKETS_FILE):
        save_data([], TICKETS_FILE)
        print("✅ Создан пустой файл заявок")

# Аутентификация
def authenticate_user(username: str, password: str):
    users = load_data(USERS_FILE)
    if username in users and users[username] == password:
        return username
    return None

def get_current_user(token: str):
    users = load_data(USERS_FILE)
    if token in users:
        return token
    raise HTTPException(status_code=401, detail="Неверный токен")

def require_admin(current_user: str):
    if current_user != "admin":
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    return current_user

# Генерация ID
def generate_arm_id():
    arms = load_data(ARMS_FILE)
    return f"ARM-{len(arms) + 1:03d}"

def generate_ticket_id():
    tickets = load_data(TICKETS_FILE)
    return f"TICKET-{datetime.now().strftime('%Y%m%d')}-{len(tickets) + 1:03d}"

# Статические файлы - правильная настройка
@app.get("/")
async def serve_index():
    index_path = os.path.join(FRONTEND_DIR, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        raise HTTPException(status_code=404, detail="index.html не найден")

@app.get("/style.css")
async def serve_css():
    css_path = os.path.join(FRONTEND_DIR, 'style.css')
    if os.path.exists(css_path):
        return FileResponse(css_path, media_type='text/css')
    else:
        raise HTTPException(status_code=404, detail="style.css не найден")

@app.get("/app.js")
async def serve_js():
    js_path = os.path.join(FRONTEND_DIR, 'app.js')
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type='application/javascript')
    else:
        raise HTTPException(status_code=404, detail="app.js не найден")

# API Routes
@app.post("/api/login")
async def login(user_data: UserLogin):
    user = authenticate_user(user_data.username, user_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Неверные учетные данные")
    
    return {
        "token": user, 
        "username": user, 
        "is_admin": user == "admin",
        "message": "Успешный вход в систему"
    }

# АРМ - только просмотр для всех авторизованных пользователей
@app.get("/api/arms")
async def get_arms(current_user: str = Depends(get_current_user)):
    arms = load_data(ARMS_FILE)
    return arms

@app.get("/api/arms/{arm_id}")
async def get_arm(arm_id: str, current_user: str = Depends(get_current_user)):
    arms = load_data(ARMS_FILE)
    arm = next((a for a in arms if a['id'] == arm_id), None)
    if not arm:
        raise HTTPException(status_code=404, detail="АРМ не найден")
    return arm

# АРМ - управление (ТОЛЬКО для админа)
@app.post("/api/admin/arms")
async def create_arm(
    arm_data: ARMCreate, 
    current_user: str = Depends(get_current_user)
):
    require_admin(current_user)
    
    arms = load_data(ARMS_FILE)
    
    # Проверка уникальности инвентарного номера
    if any(arm['inventory_number'] == arm_data.inventory_number for arm in arms):
        raise HTTPException(status_code=400, detail="АРМ с таким инвентарным номером уже существует")
    
    # Создание нового АРМ
    new_arm = {
        "id": generate_arm_id(),
        "inventory_number": arm_data.inventory_number,
        "name": arm_data.name,
        "location": arm_data.location,
        "user": arm_data.user,
        "department": arm_data.department,
        "status": "operational",
        "characteristics": arm_data.characteristics,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    arms.append(new_arm)
    if not save_data(arms, ARMS_FILE):
        raise HTTPException(status_code=500, detail="Ошибка сохранения АРМ")
    
    return {
        "message": "АРМ успешно добавлен",
        "arm": new_arm
    }

@app.put("/api/admin/arms/{arm_id}")
async def update_arm(
    arm_id: str,
    arm_data: ARMUpdate,
    current_user: str = Depends(get_current_user)
):
    require_admin(current_user)
    
    arms = load_data(ARMS_FILE)
    
    for arm in arms:
        if arm['id'] == arm_id:
            # Обновляем только переданные поля
            update_data = arm_data.dict(exclude_unset=True)
            for key, value in update_data.items():
                if key == 'characteristics' and isinstance(value, dict):
                    arm['characteristics'].update(value)
                else:
                    arm[key] = value
            
            arm['updated_at'] = datetime.now().isoformat()
            
            if not save_data(arms, ARMS_FILE):
                raise HTTPException(status_code=500, detail="Ошибка сохранения АРМ")
            
            return {
                "message": "АРМ успешно обновлен",
                "arm": arm
            }
    
    raise HTTPException(status_code=404, detail="АРМ не найден")

@app.delete("/api/admin/arms/{arm_id}")
async def delete_arm(
    arm_id: str,
    current_user: str = Depends(get_current_user)
):
    require_admin(current_user)
    
    arms = load_data(ARMS_FILE)
    tickets = load_data(TICKETS_FILE)
    
    # Проверяем активные заявки
    active_tickets = [t for t in tickets if t['arm_id'] == arm_id and t['status'] in ['new', 'in_progress']]
    if active_tickets:
        raise HTTPException(
            status_code=400, 
            detail=f"Нельзя удалить АРМ с активными заявками ({len(active_tickets)} шт.)"
        )
    
    updated_arms = [arm for arm in arms if arm['id'] != arm_id]
    
    if len(updated_arms) == len(arms):
        raise HTTPException(status_code=404, detail="АРМ не найден")
    
    if not save_data(updated_arms, ARMS_FILE):
        raise HTTPException(status_code=500, detail="Ошибка удаления АРМ")
    
    return {"message": "АРМ успешно удален"}

# Заявки - создание для всех пользователей
@app.post("/api/tickets")
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: str = Depends(get_current_user)
):
    # Проверяем существование АРМ
    arms = load_data(ARMS_FILE)
    arm = next((a for a in arms if a['id'] == ticket_data.arm_id), None)
    if not arm:
        raise HTTPException(status_code=404, detail="АРМ не найден")
    
    tickets = load_data(TICKETS_FILE)
    
    new_ticket = {
        "id": generate_ticket_id(),
        "arm_id": ticket_data.arm_id,
        "problem_type": ticket_data.problem_type,
        "priority": ticket_data.priority,
        "description": ticket_data.description,
        "status": "new",
        "created_by": current_user,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    tickets.append(new_ticket)
    if not save_data(tickets, TICKETS_FILE):
        raise HTTPException(status_code=500, detail="Ошибка сохранения заявки")
    
    return {
        "message": "Заявка успешно создана",
        "ticket": new_ticket
    }

# Заявки - просмотр
@app.get("/api/tickets")
async def get_tickets(current_user: str = Depends(get_current_user)):
    tickets = load_data(TICKETS_FILE)
    
    # Пользователи видят только свои заявки, админ - все
    if current_user != "admin":
        tickets = [t for t in tickets if t['created_by'] == current_user]
    
    return tickets

# Заявки - обновление статуса (только для админа)
@app.put("/api/admin/tickets/{ticket_id}")
async def update_ticket_status(
    ticket_id: str,
    ticket_data: TicketUpdate,
    current_user: str = Depends(get_current_user)
):
    require_admin(current_user)
    
    tickets = load_data(TICKETS_FILE)
    
    for ticket in tickets:
        if ticket['id'] == ticket_id:
            ticket['status'] = ticket_data.status
            ticket['updated_at'] = datetime.now().isoformat()
            ticket['updated_by'] = current_user
            
            if not save_data(tickets, TICKETS_FILE):
                raise HTTPException(status_code=500, detail="Ошибка сохранения заявки")
            
            return {
                "message": "Статус заявки обновлен",
                "ticket": ticket
            }
    
    raise HTTPException(status_code=404, detail="Заявка не найдена")

# Статистика
@app.get("/api/stats")
async def get_stats(current_user: str = Depends(get_current_user)):
    arms = load_data(ARMS_FILE)
    tickets = load_data(TICKETS_FILE)
    
    if current_user == "admin":
        stats = {
            "total_arms": len(arms),
            "operational_arms": len([a for a in arms if a['status'] == 'operational']),
            "total_tickets": len(tickets),
            "new_tickets": len([t for t in tickets if t['status'] == 'new']),
            "in_progress_tickets": len([t for t in tickets if t['status'] == 'in_progress']),
            "resolved_tickets": len([t for t in tickets if t['status'] == 'resolved'])
        }
    else:
        user_tickets = [t for t in tickets if t['created_by'] == current_user]
        stats = {
            "my_tickets": len(user_tickets),
            "my_new_tickets": len([t for t in user_tickets if t['status'] == 'new']),
            "my_in_progress_tickets": len([t for t in user_tickets if t['status'] == 'in_progress']),
            "my_resolved_tickets": len([t for t in user_tickets if t['status'] == 'resolved'])
        }
    
    return stats

# Запуск приложения
if __name__ == "__main__":
    import uvicorn
    init_data()
    print("=" * 50)
    print("🚀 ARM Service Desk System")
    print("=" * 50)
    print("✅ Система инициализирована")
    print("👤 Пользователи: user/user123, admin/admin123")
    print("💻 АРМ: данные добавляются через веб-интерфейс")
    print("🌐 Сервер запущен: http://localhost:8000")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)