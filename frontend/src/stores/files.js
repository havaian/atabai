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

            const response = await apiClient.get('/files/recent')
            recentFiles.value = response.data.files || []

            return recentFiles.value
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch recent files'
            console.error('Fetch recent files error:', err)
            
            // Mock data for development
            recentFiles.value = [
                {
                    id: '1',
                    name: 'Q3_Financial_Report.xlsx',
                    templateName: 'Depreciation Analysis',
                    status: 'completed',
                    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                    fileSize: 2048000,
                    processingTime: 45000
                },
                {
                    id: '2',
                    name: 'Asset_Impairment_2024.xlsx',
                    templateName: 'Asset Impairment',
                    status: 'completed',
                    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                    fileSize: 1536000,
                    processingTime: 32000
                },
                {
                    id: '3',
                    name: 'Revenue_Recognition.xlsx',
                    templateName: 'Discount Calculations',
                    status: 'processing',
                    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                    fileSize: 3072000,
                    processingTime: null
                },
                {
                    id: '4',
                    name: 'Fixed_Assets_Schedule.xlsx',
                    templateName: 'Depreciation Analysis',
                    status: 'completed',
                    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                    fileSize: 4096000,
                    processingTime: 67000
                },
                {
                    id: '5',
                    name: 'Quarterly_Impairment_Test.xlsx',
                    templateName: 'Asset Impairment',
                    status: 'completed',
                    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                    fileSize: 2560000,
                    processingTime: 51000
                }
            ]
        } finally {
            isLoading.value = false
        }
    }

    async function fetchFiles(options = {}) {
        try {
            isLoading.value = true
            error.value = null

            const params = new URLSearchParams()
            if (options.page) params.append('page', options.page)
            if (options.limit) params.append('limit', options.limit)
            if (options.status) params.append('status', options.status)
            if (options.templateId) params.append('templateId', options.templateId)

            const response = await apiClient.get(`/files?${params}`)
            files.value = response.data.files || []

            return {
                files: files.value,
                totalCount: response.data.totalCount || 0,
                totalPages: response.data.totalPages || 0,
                currentPage: response.data.currentPage || 1
            }
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch files'
            console.error('Fetch files error:', err)
            return { files: [], totalCount: 0, totalPages: 0, currentPage: 1 }
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

    async function uploadFile(file, templateId, options = {}) {
        try {
            isLoading.value = true
            error.value = null
            uploadProgress.value = 0

            const formData = new FormData()
            formData.append('file', file)
            formData.append('templateId', templateId)
            
            if (options.preserveFormatting) {
                formData.append('preserveFormatting', options.preserveFormatting)
            }
            if (options.addComments) {
                formData.append('addComments', options.addComments)
            }
            if (options.generateReport) {
                formData.append('generateReport', options.generateReport)
            }

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

            const uploadedFile = response.data.file
            
            // Add to recent files
            recentFiles.value.unshift(uploadedFile)
            if (recentFiles.value.length > 10) {
                recentFiles.value = recentFiles.value.slice(0, 10)
            }

            return uploadedFile
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to upload file'
            console.error('Upload file error:', err)
            throw err
        } finally {
            isLoading.value = false
            uploadProgress.value = 0
        }
    }

    async function processFile(fileId, templateId, options = {}) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.post(`/files/${fileId}/process`, {
                templateId,
                options
            })

            const job = response.data.job
            processingJobs.value.unshift(job)

            return job
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to start file processing'
            console.error('Process file error:', err)
            throw err
        } finally {
            isLoading.value = false
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

    async function getProcessingStatus(jobId) {
        try {
            const response = await apiClient.get(`/jobs/${jobId}/status`)
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
            return null
        }
    }

    async function retryProcessing(jobId) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.post(`/jobs/${jobId}/retry`)
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
        uploadFile,
        processFile,
        downloadFile,
        deleteFile,
        getProcessingStatus,
        retryProcessing,
        clearError
    }
})