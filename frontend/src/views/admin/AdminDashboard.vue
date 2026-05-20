<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.dashboard.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.dashboard.subtitle') }}</div>
            </div>
            <button class="adm-btn adm-btn--ghost" @click="loadStats" :disabled="loading">
                <RefreshCw :size="14" />
                {{ $t('admin.common.refresh') }}
            </button>
        </div>

        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else-if="stats">
            <!-- Top stats -->
            <div class="adm-stats-grid">
                <div class="adm-stat">
                    <div class="adm-stat-label">{{ $t('admin.dashboard.totalUsers') }}</div>
                    <div class="adm-stat-value">{{ stats.totalUsers }}</div>
                </div>
                <div class="adm-stat">
                    <div class="adm-stat-label">{{ $t('admin.dashboard.totalFiles') }}</div>
                    <div class="adm-stat-value">{{ stats.totalFiles }}</div>
                </div>
                <div class="adm-stat">
                    <div class="adm-stat-label">{{ $t('admin.dashboard.activeUsers') }}</div>
                    <div class="adm-stat-value">{{ activeUsersCount }}</div>
                </div>
                <div class="adm-stat">
                    <div class="adm-stat-label">{{ $t('admin.dashboard.filesCompleted') }}</div>
                    <div class="adm-stat-value">{{ filesByStatusMap.completed || 0 }}</div>
                </div>
                <div class="adm-stat">
                    <div class="adm-stat-label">{{ $t('admin.dashboard.filesFailed') }}</div>
                    <div class="adm-stat-value">{{ filesByStatusMap.failed || 0 }}</div>
                </div>
                <div class="adm-stat">
                    <div class="adm-stat-label">{{ $t('admin.dashboard.filesProcessing') }}</div>
                    <div class="adm-stat-value">{{ filesByStatusMap.processing || 0 }}</div>
                </div>
            </div>

            <!-- Detail cards -->
            <div class="adm-grid-2">
                <!-- Users by role -->
                <div class="adm-card">
                    <h3 class="adm-card-title">{{ $t('admin.dashboard.usersByRole') }}</h3>
                    <div v-if="stats.usersByRole.length === 0" class="adm-muted adm-text-sm">{{ $t('admin.common.noData') }}</div>
                    <div v-else class="adm-bars">
                        <div v-for="r in stats.usersByRole" :key="r._id" class="adm-bar-row">
                            <span class="adm-bar-label">
                                <span class="adm-badge" :class="`adm-badge--role-${r._id}`">{{ roleLabel(r._id) }}</span>
                            </span>
                            <span class="adm-bar-value">{{ r.count }}</span>
                        </div>
                    </div>
                </div>

                <!-- Files by template type -->
                <div class="adm-card">
                    <h3 class="adm-card-title">{{ $t('admin.dashboard.filesByTemplate') }}</h3>
                    <div v-if="stats.filesByTemplate.length === 0" class="adm-muted adm-text-sm">{{ $t('admin.common.noData') }}</div>
                    <div v-else class="adm-bars">
                        <div v-for="t in stats.filesByTemplate" :key="t._id || 'unknown'" class="adm-bar-row">
                            <span class="adm-bar-label adm-mono">{{ t._id || '—' }}</span>
                            <span class="adm-bar-value">{{ t.count }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Last 7 days -->
            <div class="adm-card adm-card-stacked">
                <h3 class="adm-card-title">{{ $t('admin.dashboard.filesLast7Days') }}</h3>
                <div v-if="stats.filesLast7Days.length === 0" class="adm-muted adm-text-sm">
                    {{ $t('admin.dashboard.noFilesThisWeek') }}
                </div>
                <div v-else class="adm-bars">
                    <div v-for="d in stats.filesLast7Days" :key="d._id" class="adm-bar-row">
                        <span class="adm-bar-label adm-mono">{{ d._id }}</span>
                        <span class="adm-bar-value">{{ d.count }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import { RefreshCw } from 'lucide-vue-next'

const adminStore = useAdminStore()
const { t } = useI18n()
const stats = ref(null)
const loading = ref(false)
const error = ref(null)

const activeUsersCount = computed(() => {
    if (!stats.value) return 0
    const active = stats.value.usersByActive.find(u => u._id === true)
    return active?.count || 0
})

const filesByStatusMap = computed(() => {
    if (!stats.value) return {}
    return Object.fromEntries(stats.value.filesByStatus.map(s => [s._id, s.count]))
})

function roleLabel(role) {
    if (role === 'super_admin') return t('admin.roles.superShort')
    if (role === 'admin') return t('admin.roles.admin')
    return t('admin.roles.user')
}

async function loadStats() {
    loading.value = true
    error.value = null
    try {
        stats.value = await adminStore.fetchStats()
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.dashboard.loadStatsError')
    } finally {
        loading.value = false
    }
}

onMounted(loadStats)
</script>

<style scoped>
.adm-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.adm-bar-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid rgba(149, 0, 255, 0.06);
}

.adm-bar-row:last-child {
    border-bottom: none;
}

.adm-bar-label {
    font-size: 13px;
    color: rgba(240, 236, 246, 0.85);
}

.adm-bar-value {
    font-size: 14px;
    font-weight: 600;
    color: rgba(240, 236, 246, 0.95);
}
</style>
