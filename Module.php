<?php declare(strict_types=1);

namespace ResourceTemplateTabs;

use Laminas\EventManager\Event;
use Laminas\EventManager\SharedEventManagerInterface;
use Laminas\ServiceManager\ServiceLocatorInterface;
use Omeka\Api\Exception\BadRequestException;
use Omeka\Module\AbstractModule;

class Module extends AbstractModule
{
    public const PAYLOAD_KEY = 'resource_template_tabs';

    public function getConfig(): array
    {
        return include __DIR__ . '/config/module.config.php';
    }

    public function install(ServiceLocatorInterface $services): void
    {
        $connection = $services->get('Omeka\Connection');
        $connection->executeStatement(<<<'SQL'
CREATE TABLE resource_template_tab (
    id INT AUTO_INCREMENT NOT NULL,
    resource_template_id INT NOT NULL,
    label VARCHAR(190) NOT NULL,
    position INT UNSIGNED NOT NULL,
    INDEX IDX_RTT_RESOURCE_TEMPLATE (resource_template_id),
    UNIQUE INDEX UNIQ_RTT_TEMPLATE_POSITION (resource_template_id, position),
    PRIMARY KEY(id),
    CONSTRAINT FK_RTT_RESOURCE_TEMPLATE FOREIGN KEY (resource_template_id)
        REFERENCES resource_template (id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB
SQL);
        $connection->executeStatement(<<<'SQL'
CREATE TABLE resource_template_tab_property (
    tab_id INT NOT NULL,
    resource_template_property_id INT NOT NULL,
    position INT UNSIGNED NOT NULL,
    INDEX IDX_RTTP_TAB (tab_id),
    UNIQUE INDEX UNIQ_RTTP_TEMPLATE_PROPERTY (resource_template_property_id),
    UNIQUE INDEX UNIQ_RTTP_TAB_POSITION (tab_id, position),
    PRIMARY KEY(tab_id, resource_template_property_id),
    CONSTRAINT FK_RTTP_TAB FOREIGN KEY (tab_id)
        REFERENCES resource_template_tab (id) ON DELETE CASCADE,
    CONSTRAINT FK_RTTP_TEMPLATE_PROPERTY FOREIGN KEY (resource_template_property_id)
        REFERENCES resource_template_property (id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB
SQL);
    }

    public function uninstall(ServiceLocatorInterface $services): void
    {
        $connection = $services->get('Omeka\Connection');
        $connection->executeStatement('DROP TABLE IF EXISTS resource_template_tab_property');
        $connection->executeStatement('DROP TABLE IF EXISTS resource_template_tab');
    }

    public function attachListeners(SharedEventManagerInterface $sharedEventManager): void
    {
        $sharedEventManager->attach(
            'Omeka\Controller\Admin\ResourceTemplate',
            'view.edit.form.before',
            [$this, 'renderTabEditor']
        );
        $sharedEventManager->attach(
            'Omeka\Controller\Admin\ResourceTemplate',
            'view.show.after',
            [$this, 'renderTemplateTabs']
        );
        $sharedEventManager->attach(
            'Omeka\Controller\Admin\Item',
            'view.edit.form.after',
            [$this, 'renderItemEditTabs']
        );
        $sharedEventManager->attach(
            'Omeka\Controller\Admin\Item',
            'view.show.after',
            [$this, 'renderItemShowTabs']
        );
        $sharedEventManager->attach(
            'Omeka\Controller\Admin\Item',
            'view.show.value',
            [$this, 'renderItemShowPropertyMarker']
        );
        $sharedEventManager->attach(
            'Omeka\Api\Adapter\ResourceTemplateAdapter',
            'api.hydrate.pre',
            [$this, 'validateTabPayload']
        );
        $sharedEventManager->attach(
            'Omeka\Api\Adapter\ResourceTemplateAdapter',
            'api.update.post',
            [$this, 'saveTabPayload']
        );
    }

    public function renderTabEditor(Event $event): void
    {
        $view = $event->getTarget();
        $routeMatch = $this->getServiceLocator()->get('Omeka\Status')->getRouteMatch();
        $resourceTemplateId = $routeMatch
            ? (int) $routeMatch->getParam('id', 0)
            : 0;
        if (!$resourceTemplateId) {
            return;
        }

        /** @var TabManager $tabManager */
        $tabManager = $this->getServiceLocator()->get(TabManager::class);
        $groups = $tabManager->getGroups($resourceTemplateId);
        $validationError = null;
        $submittedPayload = $view->params()->fromPost(self::PAYLOAD_KEY);
        if ($submittedPayload !== null) {
            try {
                $groups = $tabManager->normalisePayload($submittedPayload);
            } catch (BadRequestException $e) {
                $validationError = $e->getMessage();
                try {
                    $groups = $tabManager->preparePayloadForRedisplay($submittedPayload);
                } catch (BadRequestException $redisplayException) {
                    // A malformed payload cannot be safely rendered. Keep the
                    // stored layout, while retaining the original error.
                }
            }
        }

        $view->headLink()->appendStylesheet(
            $view->assetUrl('css/resource-template-tabs.css', 'ResourceTemplateTabs')
        );
        $view->headScript()->appendFile(
            $view->assetUrl('js/resource-template-tabs-editor.js', 'ResourceTemplateTabs')
        );

        echo $view->partial('resource-template-tabs/admin/editor', [
            'groups' => $groups,
            'validationError' => $validationError,
        ]);
    }

    public function renderTemplateTabs(Event $event): void
    {
        $view = $event->getTarget();
        $routeMatch = $this->getServiceLocator()->get('Omeka\Status')->getRouteMatch();
        $resourceTemplateId = $routeMatch
            ? (int) $routeMatch->getParam('id', 0)
            : 0;
        if (!$resourceTemplateId) {
            return;
        }

        /** @var TabManager $tabManager */
        $tabManager = $this->getServiceLocator()->get(TabManager::class);
        $groups = $tabManager->getGroups($resourceTemplateId);
        if (!$groups) {
            return;
        }

        $view->headLink()->appendStylesheet(
            $view->assetUrl('css/resource-template-tabs.css', 'ResourceTemplateTabs')
        );
        $view->headScript()->appendFile(
            $view->assetUrl('js/resource-template-tabs-show.js', 'ResourceTemplateTabs')
        );

        echo $view->partial('resource-template-tabs/admin/show-tabs', [
            'groups' => $groups,
        ]);
    }

    public function renderItemEditTabs(Event $event): void
    {
        $view = $event->getTarget();
        $routeMatch = $this->getServiceLocator()->get('Omeka\Status')->getRouteMatch();
        $itemId = $routeMatch ? (int) $routeMatch->getParam('id', 0) : 0;
        if (!$itemId) {
            return;
        }

        $item = $this->getServiceLocator()->get('Omeka\ApiManager')
            ->read('items', $itemId)->getContent();
        $resourceTemplate = $item->resourceTemplate();
        if (!$resourceTemplate) {
            return;
        }

        /** @var TabManager $tabManager */
        $tabManager = $this->getServiceLocator()->get(TabManager::class);
        $groups = $tabManager->getGroups($resourceTemplate->id());
        if (!$groups) {
            return;
        }

        $view->headLink()->appendStylesheet(
            $view->assetUrl('css/resource-template-tabs.css', 'ResourceTemplateTabs')
        );
        $view->headScript()->appendFile(
            $view->assetUrl('js/resource-template-tabs-item-edit.js', 'ResourceTemplateTabs')
        );

        echo $view->partial('resource-template-tabs/admin/item-edit-tabs', [
            'groups' => $groups,
            'resourceTemplateId' => $resourceTemplate->id(),
        ]);
    }

    public function renderItemShowTabs(Event $event): void
    {
        $view = $event->getTarget();
        $routeMatch = $this->getServiceLocator()->get('Omeka\Status')->getRouteMatch();
        $itemId = $routeMatch ? (int) $routeMatch->getParam('id', 0) : 0;
        if (!$itemId) {
            return;
        }

        $item = $this->getServiceLocator()->get('Omeka\ApiManager')
            ->read('items', $itemId)->getContent();
        $resourceTemplate = $item->resourceTemplate();
        if (!$resourceTemplate) {
            return;
        }

        /** @var TabManager $tabManager */
        $tabManager = $this->getServiceLocator()->get(TabManager::class);
        $groups = $tabManager->getGroups($resourceTemplate->id());
        if (!$groups) {
            return;
        }

        $view->headLink()->appendStylesheet(
            $view->assetUrl('css/resource-template-tabs.css', 'ResourceTemplateTabs')
        );
        $view->headScript()->appendFile(
            $view->assetUrl('js/resource-template-tabs-item-show.js', 'ResourceTemplateTabs')
        );

        echo $view->partial('resource-template-tabs/admin/item-show-tabs', [
            'groups' => $groups,
        ]);
    }

    /**
     * Stamp a stable property identity into Omeka's native rendered value.
     *
     * The marker stays inside its property block when another module filters
     * or reorders rendered values, so the browser never has to infer identity
     * from the block's position.
     */
    public function renderItemShowPropertyMarker(Event $event): void
    {
        $value = $event->getParam('value');
        if (!$value) {
            return;
        }

        $routeMatch = $this->getServiceLocator()->get('Omeka\Status')->getRouteMatch();
        $itemId = $routeMatch ? (int) $routeMatch->getParam('id', 0) : 0;
        $resource = $value->resource();
        if (!$itemId
            || $routeMatch->getParam('action') !== 'show'
            || $resource->resourceName() !== 'items'
            || $resource->id() !== $itemId
        ) {
            return;
        }

        printf(
            '<span hidden data-resource-template-tabs-property-id="%d"></span>',
            $value->property()->id()
        );
    }

    public function validateTabPayload(Event $event): void
    {
        $request = $event->getParam('request');
        $content = $request->getContent();
        if (!array_key_exists(self::PAYLOAD_KEY, $content)) {
            return;
        }

        /** @var TabManager $tabManager */
        $tabManager = $this->getServiceLocator()->get(TabManager::class);
        try {
            $content[self::PAYLOAD_KEY] = json_encode(
                $tabManager->normalisePayload($content[self::PAYLOAD_KEY]),
                JSON_THROW_ON_ERROR
            );
        } catch (BadRequestException $e) {
            $event->getParam('errorStore')->addError(
                self::PAYLOAD_KEY,
                $e->getMessage()
            );
            return;
        }
        $request->setContent($content);
    }

    public function saveTabPayload(Event $event): void
    {
        $request = $event->getParam('request');
        $content = $request->getContent();
        if (!array_key_exists(self::PAYLOAD_KEY, $content)) {
            return;
        }

        $resourceTemplate = $event->getParam('response')->getContent();
        /** @var TabManager $tabManager */
        $tabManager = $this->getServiceLocator()->get(TabManager::class);
        $tabManager->saveGroups(
            $resourceTemplate->getId(),
            $tabManager->normalisePayload($content[self::PAYLOAD_KEY])
        );
    }
}
