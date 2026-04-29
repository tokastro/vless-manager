#!/bin/sh

REPO_URL="https://raw.githubusercontent.com/tokastro/vless-manager/main"

echo "=== Установка зависимостей ==="
apk update && apk add jq curl ca-bundle

echo "=== Загрузка компонентов ==="
mkdir -p /www/luci-static/resources/view/podkop
mkdir -p /usr/libexec/rpcd
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d

# Список файлов для скачивания
FILES="usr/bin/podkop-json2vless usr/bin/podkop-scanner usr/bin/podkop-apply-node usr/bin/podkop-autopilot usr/libexec/rpcd/podkop-manage www/luci-static/resources/view/podkop/servers.js share/luci/menu.d/luci-app-podkop-manager.json share/rpcd/acl.d/luci-app-podkop-manager.json"

for f in $FILES; do
    echo "Скачивание $f..."
    curl -L -s -k -o "/$f" "$REPO_URL/$f"
done

echo "=== Настройка прав и запуск ==="
chmod +x /usr/bin/podkop-* /usr/libexec/rpcd/podkop-manage

# Инициализация конфига
if [ ! -f /etc/config/podkop_manager ]; then
    cat << 'EOF' > /etc/config/podkop_manager
config manager 'main'
	option subscription_url 'https://flusub.com'
config manager 'MAIN'
	option fixed_index '-1'
config manager 'sec'
	option fixed_index '-1'
EOF
fi

# Крон
(crontab -l 2>/dev/null | grep -v podkop-autopilot; echo "0 * * * * /usr/bin/podkop-autopilot") | crontab -

/usr/bin/podkop-scanner
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
rm -rf /tmp/luci-*

echo "=== УСТАНОВКА ЗАВЕРШЕНА! ==="
