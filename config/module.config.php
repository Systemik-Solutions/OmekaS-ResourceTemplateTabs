<?php declare(strict_types=1);

namespace ResourceTemplateTabs;

use ResourceTemplateTabs\Service\TabManagerFactory;

return [
    'service_manager' => [
        'factories' => [
            TabManager::class => TabManagerFactory::class,
        ],
    ],
    'view_manager' => [
        'template_path_stack' => [
            dirname(__DIR__) . '/view',
        ],
    ],
];
