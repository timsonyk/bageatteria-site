"""CLI-утилита: сгенерировать bcrypt-хэш пароля для ADMIN_PASSWORD_HASH в .env.

Использование:
    python -m scripts.hash_admin_password
    или из контейнера:
    docker exec -it bageatteria-backend-1 python -m scripts.hash_admin_password
"""
import getpass
import sys


def main() -> int:
    try:
        from passlib.context import CryptContext
    except ImportError:
        print("passlib не установлен. Установи 'passlib[bcrypt]'.", file=sys.stderr)
        return 1

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    print("Генерация bcrypt-хэша для пароля админа.")
    password = getpass.getpass("Новый пароль: ")
    confirm = getpass.getpass("Подтверди пароль: ")
    if password != confirm:
        print("Пароли не совпадают.", file=sys.stderr)
        return 2
    if len(password) < 8:
        print("Минимум 8 символов.", file=sys.stderr)
        return 3

    hashed = pwd_context.hash(password)
    print()
    print("Добавь в .env (или замени существующее значение):")
    print(f"ADMIN_PASSWORD_HASH={hashed}")
    print()
    print("ADMIN_PASSWORD можно убрать или оставить пустым.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
