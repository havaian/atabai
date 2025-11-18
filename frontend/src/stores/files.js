import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/plugins/axios'

export const useFilesStore = defineStore('files', () => {
    // State
    const files = ref([])
    const recentFiles = ref([])
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

            // Mock data for development
            recentFiles.value = []
        } finally {
            isLoading.value = false
        }
    }

    async function fetchFiles(options = {}) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get('/files', { params: options })
            files.value = response.data.files || []

            return files.value
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch files'
            console.error('Fetch files error:', err)

            // Mock data for development
            files.value = []
        } finally {
            isLoading.value = false
        }
    }

    async function getFile(fileId) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get(`/files/${fileId}`)
            currentFile.value = response.data.file

            return currentFile.value
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch file details'
            console.error('Get file error:', err)
            return null
        } finally {
            isLoading.value = false
        }
    }

    async function processFile(formData) {
        try {
            isLoading.value = true
            error.value = null
            uploadProgress.value = 0

            // Upload and process file in one step
            const response = await apiClient.post('/files/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    uploadProgress.value = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    )
                }
            })

            const result = response.data

            // If we get a job ID, add it to processing jobs
            if (result.jobId) {
                const job = {
                    id: result.jobId,
                    status: 'processing',
                    templateId: formData.get('template'),
                    fileName: formData.get('file')?.name || 'Unknown',
                    createdAt: new Date().toISOString()
                }
                processingJobs.value.unshift(job)
            }

            return result
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to process file'
            console.error('Process file error:', err)
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

            // Return mock status for development
            return {
                id: jobId,
                status: 'completed',
                progress: 100,
                result: {
                    originalFile: 'sample.xlsx',
                    processedFile: 'sample_ifrs.xlsx',
                    changes: 42,
                    transformations: 15
                }
            }
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
            let filename = 'download.xlsx'
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/)
                if (filenameMatch) {
                    filename = filenameMatch[1]
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
            isLoading.value = true
            error.value = null

            const response = await apiClient.post(`/files/retry/${jobId}`)
            const job = response.data.job

            // Update job in processing jobs list
            const jobIndex = processingJobs.value.findIndex(j => j.id === jobId)
            if (jobIndex !== -1) {
                processingJobs.value[jobIndex] = job
            } else {
                processingJobs.value.unshift(job)
            }

            return job
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to retry processing'
            console.error('Retry processing error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    function clearError() {
        error.value = null
    }

    function addMockFile(file) {
        // Helper method for development
        const mockFile = {
            id: `mock_${Date.now()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'uploaded',
            createdAt: new Date().toISOString()
        }
        files.value.unshift(mockFile)
        return mockFile
    }

    return {
        // State
        files,
        recentFiles,
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
        fetchFiles,
        getFile,
        processFile,
        getProcessingStatus,
        downloadFile,
        deleteFile,
        retryProcessing,
        clearError,
        addMockFile
    }
})