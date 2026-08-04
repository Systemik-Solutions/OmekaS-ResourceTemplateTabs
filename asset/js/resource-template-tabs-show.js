(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const config = document.querySelector('#resource-template-tabs-show-config');
        const table = document.querySelector('body.resource-templates.show table#properties');
        if (!config || !table) {
            return;
        }

        let savedGroups = [];
        try {
            savedGroups = JSON.parse(config.dataset.groups || '[]');
        } catch (error) {
            return;
        }

        const rows = new Map();
        table.querySelectorAll('tbody tr[data-property-id]').forEach(function (row) {
            rows.set(String(row.dataset.propertyId), row);
        });
        if (!rows.size) {
            return;
        }

        const assignedPropertyIds = new Set();
        const groups = [];
        savedGroups.forEach(function (group) {
            const propertyIds = (group.property_ids || [])
                .map(String)
                .filter(function (propertyId) {
                    if (!rows.has(propertyId)) {
                        return false;
                    }
                    assignedPropertyIds.add(propertyId);
                    return true;
                });
            if (propertyIds.length) {
                groups.push({
                    label: group.label,
                    propertyIds: propertyIds,
                });
            }
        });

        const otherPropertyIds = Array.from(rows.keys()).filter(function (propertyId) {
            return !assignedPropertyIds.has(propertyId);
        });
        if (otherPropertyIds.length) {
            groups.push({
                label: config.dataset.otherFieldsLabel,
                propertyIds: otherPropertyIds,
            });
        }
        if (!groups.length) {
            return;
        }

        const tabList = document.createElement('div');
        tabList.className = 'resource-template-show-tabs';
        tabList.setAttribute('role', 'tablist');
        tabList.setAttribute('aria-label', 'Property groups');

        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'resource-template-show-tab-empty';
        emptyMessage.textContent = config.dataset.emptyLabel;
        emptyMessage.hidden = true;

        const activateTab = function (activeIndex, focus) {
            const group = groups[activeIndex];
            const visibleIds = new Set(group.propertyIds);
            rows.forEach(function (row, propertyId) {
                const hidden = !visibleIds.has(propertyId);
                row.hidden = hidden;
                row.classList.toggle('resource-template-tab-hidden', hidden);
            });

            const buttons = Array.from(tabList.querySelectorAll('[role="tab"]'));
            buttons.forEach(function (button, index) {
                const active = index === activeIndex;
                button.setAttribute('aria-selected', active ? 'true' : 'false');
                button.tabIndex = active ? 0 : -1;
            });
            table.setAttribute('aria-labelledby', buttons[activeIndex].id);
            emptyMessage.hidden = group.propertyIds.length > 0;
            if (focus) {
                buttons[activeIndex].focus();
            }
        };

        groups.forEach(function (group, index) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'resource-template-show-tab-' + (index + 1);
            button.className = 'resource-template-show-tab';
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-controls', table.id);
            button.textContent = group.label;
            button.addEventListener('click', function () {
                activateTab(index, false);
            });
            button.addEventListener('keydown', function (event) {
                let nextIndex = null;
                if (event.key === 'ArrowRight') {
                    nextIndex = (index + 1) % groups.length;
                } else if (event.key === 'ArrowLeft') {
                    nextIndex = (index - 1 + groups.length) % groups.length;
                } else if (event.key === 'Home') {
                    nextIndex = 0;
                } else if (event.key === 'End') {
                    nextIndex = groups.length - 1;
                }
                if (nextIndex !== null) {
                    event.preventDefault();
                    activateTab(nextIndex, true);
                }
            });
            tabList.append(button);
        });

        table.before(tabList, emptyMessage);
        activateTab(0, false);
    });
})();
