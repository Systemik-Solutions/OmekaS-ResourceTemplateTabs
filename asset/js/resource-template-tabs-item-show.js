(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const config = document.querySelector('#resource-template-tabs-item-show-config');
        const metadata = document.querySelector('body.items.show #item-metadata');
        if (!config || !metadata) {
            return;
        }

        let savedGroups = [];
        let propertyIds = [];
        try {
            savedGroups = JSON.parse(config.dataset.groups || '[]');
            propertyIds = JSON.parse(config.dataset.propertyIds || '[]').map(String);
        } catch (error) {
            return;
        }
        if (!savedGroups.length || !propertyIds.length) {
            return;
        }

        const valuesList = Array.from(metadata.children).find(function (element) {
            return element.matches('dl:not(.resource-class)');
        });
        if (!valuesList) {
            return;
        }
        if (!valuesList.id) {
            valuesList.id = 'resource-template-item-show-values';
        }

        const propertyBlocks = Array.from(valuesList.children).filter(function (element) {
            return element.classList.contains('property');
        });
        if (!propertyBlocks.length || propertyBlocks.length !== propertyIds.length) {
            return;
        }

        const blocks = new Map();
        propertyBlocks.forEach(function (block, index) {
            const propertyId = propertyIds[index];
            block.dataset.propertyId = propertyId;
            blocks.set(propertyId, block);
        });

        const assignedPropertyIds = new Set();
        const groups = [];
        savedGroups.forEach(function (group) {
            const groupPropertyIds = (group.property_ids || [])
                .map(String)
                .filter(function (propertyId) {
                    if (!blocks.has(propertyId)) {
                        return false;
                    }
                    assignedPropertyIds.add(propertyId);
                    return true;
                });
            if (groupPropertyIds.length) {
                groups.push({
                    label: group.label,
                    propertyIds: groupPropertyIds,
                });
            }
        });

        const otherPropertyIds = Array.from(blocks.keys()).filter(function (propertyId) {
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
        tabList.className = 'resource-template-field-tabs resource-template-item-show-tabs';
        tabList.setAttribute('role', 'tablist');
        tabList.setAttribute('aria-label', 'Property groups');

        const activateTab = function (activeIndex, focus) {
            const visibleIds = new Set(groups[activeIndex].propertyIds);
            blocks.forEach(function (block, propertyId) {
                const hidden = !visibleIds.has(propertyId);
                block.classList.toggle('resource-template-tab-hidden', hidden);
                block.setAttribute('aria-hidden', hidden ? 'true' : 'false');
            });

            const buttons = Array.from(tabList.querySelectorAll('[role="tab"]'));
            buttons.forEach(function (button, index) {
                const active = index === activeIndex;
                button.setAttribute('aria-selected', active ? 'true' : 'false');
                button.tabIndex = active ? 0 : -1;
            });
            valuesList.setAttribute('aria-labelledby', buttons[activeIndex].id);
            if (focus) {
                buttons[activeIndex].focus();
            }
        };

        groups.forEach(function (group, index) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'resource-template-item-show-tab-' + (index + 1);
            button.className = 'resource-template-field-tab';
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-controls', valuesList.id);
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

        valuesList.before(tabList);
        activateTab(0, false);
    });
})();
