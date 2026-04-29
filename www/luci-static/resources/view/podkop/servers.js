'use strict';
'use ui';

return L.view.extend({
    // Версия для контроля обновления
    v: '2.6.1-TABLE',
    callManage: L.rpc.declare({ object: 'podkop-manage', method: 'apply', params: [ 'val', 'sec', 'idx' ] }),

    load: function() {
        L.uci.unload('podkop_manager');
        return Promise.all([
            L.uci.load('podkop_manager').catch(function() { return {} }),
            L.resolveDefault(L.fs.read('/www/podkop_nodes.json'), '[]'),
            L.uci.load('podkop').catch(function() { return {} })
        ]);
    },

    copyToClipboard: function(text) {
        var input = document.createElement('textarea');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        L.ui.addNotification(null, L.dom.create('p', {}, 'Ссылка скопирована!'), 2000);
    },

    renderUrlRow: function(container, value) {
        var row = L.dom.create('div', { 'class': 'url-row', 'style': 'display:flex; margin-bottom:4px' }, [
            L.dom.create('input', { 'type': 'text', 'class': 'cbi-input-text url-item', 'style': 'flex:1', 'value': value || '' }),
            L.dom.create('button', { 'class': 'btn cbi-button-remove', 'style': 'margin-left:4px', 'click': function(ev) { ev.target.closest('.url-row').remove(); } }, '-')
        ]);
        container.appendChild(row);
    },

    handleSave: function() {
        var urls = []; 
        document.querySelectorAll('.url-item').forEach(function(i) { if(i.value.trim()) urls.push(i.value.trim()); });
        L.ui.showModal(null, [ L.dom.create('p', { 'class': 'spinning' }, 'Сохранение...') ]);
        return this.callManage(urls.join(','), 'SAVE_URL', '0').then(function() { window.location.reload(); });
    },

    render: function(res) {
        var nodes = []; try { nodes = JSON.parse(res[1] || '[]'); } catch (e) {}
        nodes.sort(function(a, b) { return (parseFloat(a.latency) || 999) - (parseFloat(b.latency) || 999); });
        
        var currentUrls = (L.uci.get('podkop_manager', 'main', 'subscription_url') || '').split(/\s+/).filter(function(u) { return u.length > 0; });
        var pSections = L.uci.sections('podkop', 'section') || [];

        var urlContainer = L.dom.create('div', { 'id': 'url_container' });
        currentUrls.forEach(L.bind(this.renderUrlRow, this, urlContainer));
        if (!currentUrls.length) this.renderUrlRow(urlContainer, '');

        var configTable = L.dom.create('table', { 'class': 'table' }, [ 
            L.dom.create('tr', { 'class': 'tr' }, [ 
                L.dom.create('th', { 'class': 'th' }, 'Секция'), 
                L.dom.create('th', { 'class': 'th' }, 'Выбор сервера') 
            ]) 
        ]);

        pSections.forEach(L.bind(function(s) {
            var sName = s['.name'];
            var savedIdx = parseInt(L.uci.get('podkop_manager', sName, 'fixed_index') || '-1');
            var sel = L.dom.create('select', { 'class': 'cbi-input-select', 'style': 'width: 100%', 'change': L.bind(function(ev) {
                L.ui.showModal(null, [ L.dom.create('p', { 'class': 'spinning' }, 'Применяю...') ]);
                this.callManage(ev.target.value, sName, (ev.target.selectedIndex === 0 ? "-1" : ev.target.selectedIndex.toString())).then(function() { window.location.reload(); });
            }, this) }, [ L.dom.create('option', { 'value': 'auto', 'selected': (savedIdx === -1) ? 'selected' : null }, '-- Автоматически --') ]);
            
            nodes.forEach(function(n, i) { 
                if (parseFloat(n.latency) > 0) 
                    sel.appendChild(L.dom.create('option', { 'value': n.raw, 'selected': (savedIdx === (i+1)) ? 'selected' : null }, n.name + ' (' + n.latency + ' ms)')); 
            });
            configTable.appendChild(L.dom.create('tr', { 'class': 'tr' }, [ L.dom.create('td', { 'class': 'td' }, L.dom.create('strong', {}, sName)), L.dom.create('td', { 'class': 'td' }, sel) ]));
        }, this));

        // ТАБЛИЦА ВСЕХ СЕРВЕРОВ
        var nodesTable = L.dom.create('table', { 'class': 'table' }, [
            L.dom.create('tr', { 'class': 'tr' }, [
                L.dom.create('th', { 'class': 'th' }, 'Название'),
                L.dom.create('th', { 'class': 'th', 'style': 'width:100px' }, 'Пинг'),
                L.dom.create('th', { 'class': 'th', 'style': 'width:100px' }, 'Ссылка')
            ])
        ]);

        nodes.forEach(L.bind(function(n) {
            nodesTable.appendChild(L.dom.create('tr', { 'class': 'tr' }, [
                L.dom.create('td', { 'class': 'td' }, n.name),
                L.dom.create('td', { 'class': 'td' }, (parseFloat(n.latency) > 0 ? n.latency + ' ms' : 'error')),
                L.dom.create('td', { 'class': 'td' }, [
                    L.dom.create('button', { 'class': 'btn', 'click': L.bind(this.copyToClipboard, this, n.raw) }, 'Copy')
                ])
            ]));
        }, this));

        return L.dom.create('div', { 'class': 'cbi-map' }, [
            L.dom.create('h2', {}, 'VLESS Менеджер [' + this.v + ']'),
            L.dom.create('div', { 'class': 'cbi-section' }, [
                L.dom.create('div', { 'class': 'cbi-value' }, [
                    L.dom.create('label', { 'class': 'cbi-value-title' }, 'Подписки'),
                    L.dom.create('div', { 'class': 'cbi-value-field' }, [
                        urlContainer,
                        L.dom.create('div', { 'style': 'margin-top:8px' }, [
                            L.dom.create('button', { 'class': 'btn cbi-button-add', 'click': L.bind(function() { this.renderUrlRow(urlContainer, ''); }, this) }, '+'),
                            L.dom.create('button', { 'class': 'btn cbi-button-save', 'style': 'margin-left:8px', 'click': L.bind(this.handleSave, this) }, 'Обновить всё')
                        ])
                    ])
                ])
            ]),
            L.dom.create('div', { 'class': 'cbi-section' }, [ L.dom.create('h3', {}, 'Секции'), configTable ]),
            L.dom.create('div', { 'class': 'cbi-section' }, [ L.dom.create('h3', {}, 'Список серверов'), nodesTable ])
        ]);
    }
});
