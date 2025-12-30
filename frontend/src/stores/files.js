import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/plugins/axios'

export const useFilesStore = defineStore('files', () => {
    // State
    const files = ref([])
    const recentFiles = ref([])
    const templateFiles = ref({}) // Cache by template type
    const currentFile = ref(null)
    const processingJobs = ref([])
    const isLoading = ref(false)
    const error = ref(null)
    const uploadProgress = ref(0)

    // Cache timestamps to avoid unnecessary requests
    const cacheTimestamps = ref({
        recentFiles: null,
        templateFiles: {}
    })

    // Cache duration in milliseconds (5 minutes)
    const CACHE_DURATION = 5 * 60 * 1000

    // Getters
    const totalFilesProcessed = computed(() => files.value.length)
    const pendingJobs = computed(() => processingJobs.value.filter(job => job.status === 'pending'))
    const completedJobs = computed(() => processingJobs.value.filter(job => job.status === 'completed'))
    const failedJobs = computed(() => processingJobs.value.filter(job => job.status === 'failed'))

    // Helper function to check if data is fresh
    function isCacheFresh(timestamp) {
        if (!timestamp) return false
        return Date.now() - timestamp < CACHE_DURATION
    }

    // Helper function to invalidate cache (call after uploads/deletes)
    function invalidateCache() {
        cacheTimestamps.value.recentFiles = null
        cacheTimestamps.value.templateFiles = {}
    }

    // Get template files for a specific template (with caching)
    function getTemplateFilesFromCache(templateType) {
        return templateFiles.value[templateType] || []
    }

    // Actions
    async function fetchRecentFiles(forceRefresh = false) {
        // Return cached data if fresh and not forcing refresh
        if (!forceRefresh &&
            isCacheFresh(cacheTimestamps.value.recentFiles) &&
            recentFiles.value.length > 0) {
            return recentFiles.value
        }

        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get('/files/history', {
                params: { limit: 20 } // Get more for sidebar and other uses
            })

            recentFiles.value = response.data.files || []
            cacheTimestamps.value.recentFiles = Date.now()

            return recentFiles.value
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch recent files'
            console.error('Fetch recent files error:', err)
            recentFiles.value = []
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function fetchTemplateFiles(templateType, options = {}, forceRefresh = false) {
        // Return cached data if fresh and not forcing refresh
        if (!forceRefresh &&
            isCacheFresh(cacheTimestamps.value.templateFiles[templateType]) &&
            templateFiles.value[templateType]?.length > 0) {
            return {
                files: templateFiles.value[templateType],
                statusSummary: {},
                pagination: {},
                templateType
            }
        }

        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get(`/files/template/${templateType}`, {
                params: {
                    limit: options.limit || 10, // Default to 10 for template-specific
                    ...options
                }
            })

            // Cache the results
            templateFiles.value[templateType] = response.data.files || []
            cacheTimestamps.value.templateFiles[templateType] = Date.now()

            return {
                files: response.data.files || [],
                statusSummary: response.data.statusSummary || {},
                pagination: response.data.pagination || {},
                templateType: response.data.templateType
            }
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch template files'
            console.error('Fetch template files error:', err)
            templateFiles.value[templateType] = []
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function fetchFiles(options = {}) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get('/files/history', { params: options })
            files.value = response.data.files || []

            return files.value
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch files'
            console.error('Fetch files error:', err)
            files.value = []
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function getFileDetails(fileId) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get(`/files/${fileId}`)
            currentFile.value = response.data

            return response.data
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch file details'
            console.error('Get file details error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function uploadFile(file, templateType, progressCallback) {
        try {
            isLoading.value = true
            error.value = null
            uploadProgress.value = 0

            const formData = new FormData()
            formData.append('file', file)
            formData.append('template', templateType)

            const response = await apiClient.post('/files/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    )
                    uploadProgress.value = percentCompleted
                    if (progressCallback) {
                        progressCallback(percentCompleted)
                    }
                }
            })

            // Invalidate cache since we have new data
            invalidateCache()

            return response.data
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to upload file'
            console.error('Upload file error:', err)
            throw err
        } finally {
            isLoading.value = false
            uploadProgress.value = 0
        }
    }

    async function getProcessingStatus(jobId) {
        try {
            const response = await apiClient.get(`/files/status/${jobId}`)
            const job = response.data.job

            // Update job in processing jobs list
            const jobIndex = processingJobs.value.findIndex(j => j.id === jobId)
            if (jobIndex !== -1) {
                processingJobs.value[jobIndex] = job
            }

            return job
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to get processing status'
            console.error('Get processing status error:', err)
            throw err
        }
    }

    async function downloadFile(fileId, type = 'processed') {
        try {
            const response = await apiClient.get(`/files/${fileId}/download`, {
                params: { type },
                responseType: 'blob'
            })

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url

            // Get filename from response headers or use default
            const contentDisposition = response.headers['content-disposition']
            let filename = `${fileId}.xlsx`
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
                if (filenameMatch) {
                    filename = filenameMatch[1].replace(/['"]/g, '')
                }
            }

            link.setAttribute('download', filename)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            return true
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to download file'
            console.error('Download file error:', err)
            throw err
        }
    }

    async function deleteFile(fileId) {
        try {
            isLoading.value = true
            error.value = null

            await apiClient.delete(`/files/${fileId}`)

            // Remove from local state
            files.value = files.value.filter(file => file.id !== fileId)
            recentFiles.value = recentFiles.value.filter(file => file.id !== fileId)

            // Remove from template files cache
            Object.keys(templateFiles.value).forEach(templateType => {
                templateFiles.value[templateType] = templateFiles.value[templateType].filter(
                    file => file.id !== fileId
                )
            })

            if (currentFile.value?.id === fileId) {
                currentFile.value = null
            }

            return true
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to delete file'
            console.error('Delete file error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function retryProcessing(jobId) {
        try {
            const response = await apiClient.post(`/files/retry/${jobId}`)
            const job = response.data.job

            // Update job in processing jobs list
            const jobIndex = processingJobs.value.findIndex(j => j.id === jobId)
            if (jobIndex !== -1) {
                processingJobs.value[jobIndex] = job
            }

            return job
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to retry processing'
            console.error('Retry processing error:', err)
            throw err
        }
    }
    

    /**
     * Add a newly uploaded file to the recent files list
     */
    const addUploadedFile = (fileData) => {
        // Create a properly formatted file object
        const newFile = {
            id: fileData.fileId || fileData.id,
            originalName: fileData.fileName || fileData.originalName,
            status: fileData.status || 'uploaded',
            templateType: fileData.templateType,
            jobId: fileData.jobId,
            createdAt: fileData.createdAt || new Date().toISOString(),
            updatedAt: fileData.updatedAt || new Date().toISOString()
        }

        // Add to the beginning of the array (most recent first)
        recentFiles.value.unshift(newFile)

        // Keep only the last 50 files to avoid memory issues
        if (recentFiles.value.length > 50) {
            recentFiles.value = recentFiles.value.slice(0, 50)
        }

        console.log('[FILES STORE] Added uploaded file:', newFile.originalName)
    }

    /**
     * Update a file's status in the recent files list
     */
    const updateFileStatus = (fileId, status, additionalData = {}) => {
        const fileIndex = recentFiles.value.findIndex(f => f.id === fileId)
        
        if (fileIndex !== -1) {
            recentFiles.value[fileIndex] = {
                ...recentFiles.value[fileIndex],
                status,
                updatedAt: new Date().toISOString(),
                ...additionalData
            }
            
            console.log('[FILES STORE] Updated file status:', fileId, 'to', status)
        } else {
            console.warn('[FILES STORE] File not found for status update:', fileId)
        }
    }

    // Clear store state
    function clearState() {
        files.value = []
        recentFiles.value = []
        templateFiles.value = {}
        currentFile.value = null
        processingJobs.value = []
        error.value = null
        uploadProgress.value = 0
        cacheTimestamps.value = {
            recentFiles: null,
            templateFiles: {}
        }
    }

    return {
        // State
        files,
        recentFiles,
        templateFiles,
        currentFile,
        processingJobs,
        isLoading,
        error,
        uploadProgress,

        // Getters
        totalFilesProcessed,
        pendingJobs,
        completedJobs,
        failedJobs,
        getTemplateFilesFromCache,

        // Actions
        fetchRecentFiles,
        fetchTemplateFiles,
        fetchFiles,
        getFileDetails,
        uploadFile,
        getProcessingStatus,
        downloadFile,
        deleteFile,
        retryProcessing,
        invalidateCache,
        addUploadedFile,
        updateFileStatus,
        clearState
    }
})