import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/plugins/axios'

export const useFilesStore = defineStore('files', () => {
    // State
    const files = ref([])
    const recentFiles = ref([])
    const templateFiles = ref([])
    const currentFile = ref(null)
    const processingJobs = ref([])
    const isLoading = ref(false)
    const error = ref(null)
    const uploadProgress = ref(0)

    // Getters
    const totalFilesProcessed = computed(() => files.value.length)
    const pendingJobs = computed(() => processingJobs.value.filter(job => job.status === 'pending'))
    const completedJobs = computed(() => processingJobs.value.filter(job => job.status === 'completed'))
    const failedJobs = computed(() => processingJobs.value.filter(job => job.status === 'failed'))

    // Actions
    async function fetchRecentFiles() {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get('/files/history')
            recentFiles.value = response.data.files || []

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

    async function fetchTemplateFiles(templateType, options = {}) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get(`/files/template/${templateType}`, {
                params: options
            })

            templateFiles.value = response.data.files || []

            return {
                files: response.data.files || [],
                statusSummary: response.data.statusSummary || {},
                pagination: response.data.pagination || {},
                templateType: response.data.templateType
            }
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch template files'
            console.error('Fetch template files error:', err)
            templateFiles.value = []
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

    async function uploadFile(file, templateType, onProgress) {
        try {
            isLoading.value = true
            uploadProgress.value = 0
            error.value = null

            const formData = new FormData()
            formData.append('file', file)
            formData.append('template', templateType)

            const response = await apiClient.post('/files/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    uploadProgress.value = percentCompleted
                    if (onProgress) onProgress(percentCompleted)
                }
            })

            // Add to processing jobs
            if (response.data.jobId) {
                processingJobs.value.push({
                    id: response.data.jobId,
                    status: 'pending',
                    progress: 0,
                    templateType: templateType,
                    fileName: file.name,
                    fileId: response.data.fileId
                })
            }

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
            templateFiles.value = templateFiles.value.filter(file => file.id !== fileId)

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

    // Clear store state
    function clearState() {
        files.value = []
        recentFiles.value = []
        templateFiles.value = []
        currentFile.value = null
        processingJobs.value = []
        error.value = null
        uploadProgress.value = 0
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
        clearState
    }
})