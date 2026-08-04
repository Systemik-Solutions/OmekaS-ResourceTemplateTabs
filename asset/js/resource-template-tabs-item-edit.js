(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const config = document.querySelector('#resource-template-tabs-item-edit-config');
        const properties = document.querySelector('#resource-values div#properties');
        const templateSelect = document.querySelector('#resource-template-select');
        if (!config || !properties || !templateSelect) {
            return;
        }

        let savedGroups = [];
        try {
            savedGroups = JSON.parse(config.dataset.groups || '[]');
        } catch (error) {
            return;
        }
        if (!savedGroups.length) {
            return;
        }

        const configuredTemplateId = String(config.dataset.resourceTemplateId);
        const tabList = document.createElement('div');
        tabList.className = 'resource-template-field-tabs resource-template-item-edit-tabs';
        tabList.setAttribute('role', 'tablist');
        tabList.setAttribute('aria-label', 'Property groups');
        properties.before(tabList);

        let activeGroupKey = 'group-0';
        let displayedGroups = [];
        let applyScheduled = false;

        const getFields = function () {
            return Array.from(properties.querySelectorAll(':scope > .resource-property[data-property-id]'));
        };

        const showAllFields = function () {
            getFields().forEach(function (field) {
                field.classList.remove('resource-template-tab-hidden');
                field.removeAttribute('aria-hidden');
            });
            tabList.hidden = true;
        };

        const activateGroup = function (groupKey, focus) {
            const group = displayedGroups.find(function (candidate) {
                return candidate.key === groupKey;
            });
            if (!group) {
                return;
            }
            activeGroupKey = groupKey;
            const visiblePropertyIds = new Set(group.propertyIds);
            getFields().forEach(function (field) {
                const hidden = !visiblePropertyIds.has(String(field.dataset.propertyId));
                field.classList.toggle('resource-template-tab-hidden', hidden);
                field.setAttribute('aria-hidden', hidden ? 'true' : 'false');
            });

            const buttons = Array.from(tabList.querySelectorAll('[role="tab"]'));
            buttons.forEach(function (button) {
                const active = button.dataset.groupKey === groupKey;
                button.setAttribute('aria-selected', active ? 'true' : 'false');
                button.tabIndex = active ? 0 : -1;
            });
            properties.setAttribute(
                'aria-labelledby',
                tabList.querySelector('[aria-selected="true"]').id
            );
            if (focus) {
                tabList.querySelector('[aria-selected="true"]').focus();
            }
        };

        const rebuildTabs = function () {
            applyScheduled = false;
            if (String(templateSelect.value) !== configuredTemplateId) {
                displayedGroups = [];
                tabList.replaceChildren();
                showAllFields();
                return;
            }

            const fields = getFields();
            const fieldIds = new Set(fields.map(function (field) {
                return String(field.dataset.propertyId);
            }));
            const assignedIds = new Set();
            displayedGroups = [];
            savedGroups.forEach(function (group, index) {
                const propertyIds = (group.property_ids || [])
                    .map(String)
                    .filter(function (propertyId) {
                        if (!fieldIds.has(propertyId)) {
                            return false;
                        }
                        assignedIds.add(propertyId);
                        return true;
                    });
                if (propertyIds.length) {
                    displayedGroups.push({
                        key: 'group-' + index,
                        label: group.label,
                        propertyIds: propertyIds,
                    });
                }
            });

            const otherPropertyIds = Array.from(fieldIds).filter(function (propertyId) {
                return !assignedIds.has(propertyId);
            });
            if (otherPropertyIds.length) {
                displayedGroups.push({
                    key: 'other',
                    label: config.dataset.otherFieldsLabel,
                    propertyIds: otherPropertyIds,
                });
            }
            if (!displayedGroups.length) {
                tabList.replaceChildren();
                showAllFields();
                return;
            }

            tabList.replaceChildren();
            displayedGroups.forEach(function (group, index) {
                const button = document.createElement('button');
                button.type = 'button';
                button.id = 'resource-template-item-edit-tab-' + (index + 1);
                button.className = 'resource-template-field-tab';
                button.dataset.groupKey = group.key;
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-controls', properties.id);
                button.textContent = group.label;
                button.addEventListener('click', function () {
                    activateGroup(group.key, false);
                });
                button.addEventListener('keydown', function (event) {
                    let nextIndex = null;
                    if (event.key === 'ArrowRight') {
                        nextIndex = (index + 1) % displayedGroups.length;
                    } else if (event.key === 'ArrowLeft') {
                        nextIndex = (index - 1 + displayedGroups.length)
                            % displayedGroups.length;
                    } else if (event.key === 'Home') {
                        nextIndex = 0;
                    } else if (event.key === 'End') {
                        nextIndex = displayedGroups.length - 1;
                    }
                    if (nextIndex !== null) {
                        event.preventDefault();
                        activateGroup(displayedGroups[nextIndex].key, true);
                    }
                });
                tabList.append(button);
            });
            tabList.hidden = false;

            if (!displayedGroups.some(function (group) {
                return group.key === activeGroupKey;
            })) {
                activeGroupKey = displayedGroups[0].key;
            }
            activateGroup(activeGroupKey, false);

            const firstErrorField = fields.find(function (field) {
                return field.querySelector('.messages:not(:empty), .error');
            });
            if (firstErrorField) {
                activateGroupForField(firstErrorField, false);
            }
        };

        const scheduleRebuild = function () {
            if (applyScheduled) {
                return;
            }
            applyScheduled = true;
            window.setTimeout(rebuildTabs, 0);
        };

        const activateGroupForField = function (field, focus) {
            const propertyId = String(field.dataset.propertyId);
            const group = displayedGroups.find(function (candidate) {
                return candidate.propertyIds.includes(propertyId);
            });
            if (group) {
                activateGroup(group.key, focus);
            }
        };

        properties.closest('form')?.addEventListener('invalid', function (event) {
            const field = event.target.closest('.resource-property[data-property-id]');
            if (field) {
                activateGroupForField(field, false);
            }
        }, true);

        templateSelect.addEventListener('change', scheduleRebuild);
        new MutationObserver(scheduleRebuild).observe(properties, {
            childList: true,
        });
        if (window.jQuery) {
            window.jQuery(properties.closest('form')).on('o:form-loaded', scheduleRebuild);
        }
        scheduleRebuild();
    });
})();
