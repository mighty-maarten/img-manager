import type { Component } from 'vue';
import 'vue-router';

export {};

declare module 'vue-router' {
    interface RouteMeta {
        layout?: Component;
    }
}
